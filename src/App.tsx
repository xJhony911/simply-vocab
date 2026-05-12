import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  CheckCircle2, XCircle, Brain, RefreshCw, BookOpen, Clock, 
  Settings, Search, Plus, Calendar, ChevronRight, BarChart3,
  LayoutDashboard, Server, User, ListFilter, Heart, Zap, 
  RotateCcw, Sparkles, Trophy, AlertTriangle, Send,
  Trash2, Edit3, Volume2, VolumeX, Info, List,
  FileDown, FileUp
} from 'lucide-react';
import { sounds } from './lib/sounds';

interface PhrasalVerb {
  id: string;
  Verbo_Ingles: string;
  Significado_Espanol: string;
  Concepto_Ingles: string;
  Ejemplo_Uso: string;
  Fallos_Totales: number;
  activo?: boolean;
}

type Mode = 'menu' | 'flashcards' | 'survival' | 'gameover' | 'results' | 'reading' | 'auditivo';
type SettingsView = 'main' | 'dictionary' | 'edit' | 'add';

interface SessionStats {
  total: number;
  successes: number;
  errors: number;
  errorIds: string[];
  lastMode?: Mode;
}

export default function App() {
  const [cards, setCards] = useState<PhrasalVerb[]>([]);
  const [sessionCards, setSessionCards] = useState<PhrasalVerb[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('menu');
  const [sessionsStarted, setSessionsStarted] = useState(() => Number(localStorage.getItem('sessions_started')) || 0);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [readingSort, setReadingSort] = useState<'default' | 'az' | 'za'>('default');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showAuditivoHint, setShowAuditivoHint] = useState(false);
  const [auditivoCorrectPanel, setAuditivoCorrectPanel] = useState(false);
  
  // Settings & Theme
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as any) || 'dark');
  const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large'>('normal');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [editingVerb, setEditingVerb] = useState<PhrasalVerb | null>(null);
  const [newVerb, setNewVerb] = useState({ ingles: '', continuous: '', espanol: '' });
  
  const [jsonInput, setJsonInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem('muted') === 'true');
  
  // Session Stats
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    total: 0,
    successes: 0,
    errors: 0,
    errorIds: [],
    lastMode: 'menu'
  });
  
  // Survival Mode State
  const [lives, setLives] = useState(3);
  const [timer, setTimer] = useState(15);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- EXPORT / IMPORT LOGIC ---
  const handleExportJson = () => {
    const dataStr = JSON.stringify(cards, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mis_verbos.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const importedCards = Array.isArray(json) ? json : [json];
        
        const validated = importedCards.map(v => ({
          id: v.id || Math.random().toString(36).substr(2, 9),
          Verbo_Ingles: v.Verbo_Ingles || '',
          Significado_Espanol: v.Significado_Espanol || '',
          Concepto_Ingles: v.Concepto_Ingles || '',
          Ejemplo_Uso: v.Ejemplo_Uso || '',
          Fallos_Totales: v.Fallos_Totales || 0
        }));

        if (confirm("¿Deseas sobrescribir el diccionario actual? (Cancelar para fusionar con los datos existentes)")) {
          setCards(validated);
          alert(`Diccionario sobrescrito con ${validated.length} verbos.`);
        } else {
          setCards(prev => [...prev, ...validated]);
          alert(`Fusionados ${validated.length} verbos correctamente.`);
        }
      } catch (error) {
        alert("Error al procesar el archivo. Asegúrate de que sea un JSON válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportFromText = () => {
    if (!jsonInput.trim()) return;
    try {
      const json = JSON.parse(jsonInput);
      const importedCards = Array.isArray(json) ? json : [json];
      
      const validated = importedCards.map(v => ({
        id: v.id || Math.random().toString(36).substr(2, 9),
        Verbo_Ingles: v.Verbo_Ingles || '',
        Significado_Espanol: v.Significado_Espanol || '',
        Concepto_Ingles: v.Concepto_Ingles || '',
        Ejemplo_Uso: v.Ejemplo_Uso || '',
        Fallos_Totales: v.Fallos_Totales || 0
      }));

      setCards(prev => [...prev, ...validated]);
      setJsonInput('');
      alert(`Fusionados ${validated.length} verbos correctamente.`);
    } catch (error) {
      alert("El formato JSON no es válido. Revisa las comillas y corchetes.");
    }
  };

  // --- AUDIO LOGIC ---
  const reproducirAudioLocal = (texto: string) => {
    if (!window.speechSynthesis) {
      console.warn("Tu navegador no soporta síntesis de voz.");
      return;
    }
    
    // 1. Limpiar audios atascados
    window.speechSynthesis.cancel();
    
    // 2. Configurar el nuevo audio
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'en-US'; // Forzar inglés
    utterance.rate = 0.9; // Un poco más lento para escuchar bien
    
    // 3. Manejar el estado visual (si aplica)
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    // 4. Seleccionar una voz nativa (Google US English si existe)
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.includes('en-US') && v.name.includes('Google')) || voices.find(v => v.lang.includes('en-'));
    if (englishVoice) utterance.voice = englishVoice;

    // 5. Hablar
    window.speechSynthesis.speak(utterance);
  };

  // Initialize Data
  useEffect(() => {
    const saved = localStorage.getItem('leitner_verbs');
    if (saved) {
      setCards(JSON.parse(saved));
    } else {
      // Seed initial data if empty
      const seed: PhrasalVerb[] = [
        { id: '1', Verbo_Ingles: 'Abide by', Significado_Espanol: 'Cumplir / Acatar', Concepto_Ingles: 'To respect or obey a decision, law or rule', Ejemplo_Uso: 'The citizens are abiding by the new safety regulations this week.', Fallos_Totales: 0 },
        { id: '2', Verbo_Ingles: 'Back down', Significado_Espanol: 'Echarse atrás', Concepto_Ingles: 'To withdraw a claim or concede defeat', Ejemplo_Uso: 'They are backing down on their initial demands after the meeting.', Fallos_Totales: 0 },
        { id: '3', Verbo_Ingles: 'Blow up', Significado_Espanol: 'Explotar', Concepto_Ingles: 'To explode or become suddenly angry', Ejemplo_Uso: 'The argument is blowing up into a major conflict between them.', Fallos_Totales: 0 }
      ];
      setCards(seed);
      localStorage.setItem('leitner_verbs', JSON.stringify(seed));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('leitner_verbs', JSON.stringify(cards));
  }, [cards]);

  useEffect(() => {
    localStorage.setItem('sessions_started', sessionsStarted.toString());
  }, [sessionsStarted]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    sounds.setEnabled(!muted);
    localStorage.setItem('muted', String(muted));
  }, [muted]);

  const topDifficultVerbs = useMemo(() => {
    return cards
      .filter(v => v.activo !== false)
      .sort((a, b) => b.Fallos_Totales - a.Fallos_Totales)
      .slice(0, 3);
  }, [cards]);

  const readingSortedCards = useMemo(() => {
    const list = cards.filter(v => v.activo !== false);
    if (readingSort === 'az') return list.sort((a, b) => a.Verbo_Ingles.localeCompare(b.Verbo_Ingles));
    if (readingSort === 'za') return list.sort((a, b) => b.Verbo_Ingles.localeCompare(a.Verbo_Ingles));
    return list;
  }, [cards, readingSort]);

  const fontSizeMap = {
    small: '14px',
    normal: '16px',
    large: '18px'
  };

  const chartData = useMemo(() => {
    const activeCards = cards.filter(v => v.activo !== false);
    const total = activeCards.length;
    if (total === 0) return [];
    
    const dominados = activeCards.filter(c => c.Fallos_Totales === 0).length;
    const enRepaso = total - dominados;
    
    return [
      { name: 'Dominados', value: dominados, color: '#10b981' },
      { name: 'En Repaso', value: enRepaso, color: '#f43f5e' }
    ];
  }, [cards]);

  const startSession = (subset?: PhrasalVerb[], targetMode: Mode = 'flashcards') => {
    let cardsToStudy = subset || cards.filter(v => v.activo !== false);
    if (cardsToStudy.length === 0) {
      alert("No hay tarjetas activas para repasar.");
      return;
    }

    if (shuffleEnabled) {
      const shuffled = [...cardsToStudy];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      cardsToStudy = shuffled;
    }

    setSessionsStarted(prev => prev + 1);
    setSessionCards(cardsToStudy);
    setSessionStats({ total: 0, successes: 0, errors: 0, errorIds: [], lastMode: targetMode });
    setCurrentIndex(0);
    setShowAnswer(false);
    setUserInput('');
    setFeedback('none');
    setAiTip(null);
    setLives(3);
    setTimer(15);
    setMode(targetMode);
    setShowAuditivoHint(false);
    setAuditivoCorrectPanel(false);

    if (targetMode === 'auditivo' && cardsToStudy[0]) {
      setTimeout(() => reproducirAudioLocal(cardsToStudy[0].Verbo_Ingles), 500);
    }
  };

  const updateCardReview = (id: string, success: boolean) => {
    setCards(prev => prev.map(card => {
      if (card.id !== id) return card;
      return {
        ...card,
        Fallos_Totales: success ? card.Fallos_Totales : card.Fallos_Totales + 1
      };
    }));
  };

  const handleDeleteVerb = (e: React.MouseEvent | React.FormEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que quieres eliminar este verbo? Esta acción no se puede deshacer.")) {
      setCards(prev => {
        const updated = prev.filter(c => String(c.id) !== String(id));
        localStorage.setItem('leitner_verbs', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const toggleActiveVerb = (id: string) => {
    setCards(prev => {
      const updated = prev.map(c => {
        if (String(c.id) !== String(id)) return c;
        return { ...c, activo: c.activo === false ? true : false };
      });
      localStorage.setItem('leitner_verbs', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteAll = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que deseas borrar todo tu vocabulario? Esta acción no se puede deshacer.")) {
      setCards([]);
      localStorage.removeItem('leitner_verbs');
    }
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVerb) return;
    setCards(prev => {
      const updated = prev.map(c => c.id === editingVerb.id ? editingVerb : c);
      localStorage.setItem('leitner_verbs', JSON.stringify(updated));
      return updated;
    });
    setSettingsView('dictionary');
    setEditingVerb(null);
  };

  // --- FLASHCARDS LOGIC ---
  const handleReview = (success: boolean) => {
    const card = sessionCards[currentIndex];
    if (!card) return;
    updateCardReview(card.id, success);
    
    setSessionStats(prev => ({
      total: prev.total + 1,
      successes: success ? prev.successes + 1 : prev.successes,
      errors: success ? prev.errors : prev.errors + 1,
      errorIds: success ? prev.errorIds : [...prev.errorIds, card.id]
    }));

    if (success) sounds.playCorrect();
    else sounds.playWrong();

    // Fix ghost text: flip back first
    setShowAnswer(false);
    
    setTimeout(() => {
      if (currentIndex < sessionCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setMode('results');
      }
    }, 400); 
  };

  const auditivoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- SURVIVAL MODE LOGIC ---
  useEffect(() => {
    if (mode === 'survival' && !isProcessing && timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer(t => t - 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    if (mode === 'survival' && timer === 0 && !isProcessing) {
      handleSurvivalFail("Tiempo agotado");
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, timer, isProcessing]);

  const handleSurvivalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Si hay un tip de error visible, el ENTER sirve para continuar
    if (aiTip) {
      continueAfterFail();
      return;
    }

    if (isProcessing) return;

    const currentCard = sessionCards[currentIndex];
    const isCorrect = userInput.trim().toLowerCase() === currentCard.Verbo_Ingles.trim().toLowerCase();

    if (isCorrect) {
      handleSurvivalSuccess();
    } else {
      handleSurvivalFail();
    }
  };

  const handleSurvivalSuccess = () => {
    setIsProcessing(true);
    setFeedback('correct');
    sounds.playCorrect();
    const card = sessionCards[currentIndex];
    updateCardReview(card.id, true);

    setSessionStats(prev => ({
      ...prev,
      total: prev.total + 1,
      successes: prev.successes + 1
    }));
    
    setTimeout(() => {
      if (currentIndex < sessionCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setTimer(15);
        setUserInput('');
        setFeedback('none');
        setIsProcessing(false);
      } else {
        setMode('results');
        setIsProcessing(false);
      }
    }, 800);
  };

  const handleSurvivalFail = (timeoutMsg?: string) => {
    setIsProcessing(true);
    setFeedback('wrong');
    sounds.playWrong();
    const card = sessionCards[currentIndex];
    
    updateCardReview(card.id, false);
    setLives(l => l - 1);

    setSessionStats(prev => ({
      ...prev,
      total: prev.total + 1,
      errors: prev.errors + 1,
      errorIds: [...prev.errorIds, card.id]
    }));

    if (lives > 1) {
      setAiTip(`El verbo correcto era: ${card.Verbo_Ingles}`);
    } else {
      setTimeout(() => {
        setMode('results');
        setIsProcessing(false);
      }, 1500);
    }
  };

  const continueAfterFail = () => {
    if (lives > 0) {
      if (currentIndex < sessionCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setTimer(15);
        setUserInput('');
        setFeedback('none');
        setAiTip(null);
        setIsProcessing(false);
      } else {
        setMode('results');
        setAiTip(null);
        setIsProcessing(false);
      }
    }
  };

  // --- AUDITIVO MODE LOGIC ---
  const handleAuditivoSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Si el panel de acierto está abierto, ENTER continúa
    if (auditivoCorrectPanel) {
      nextAuditivoWord();
      return;
    }

    // Si hay un tip de error (en auditivo), ENTER continúa inmediatamente
    if (aiTip && mode === 'auditivo') {
      if (auditivoTimeoutRef.current) clearTimeout(auditivoTimeoutRef.current);
      nextAuditivoWord();
      return;
    }

    if (isProcessing) return;

    const currentCard = sessionCards[currentIndex];
    if (!currentCard) return;

    if (userInput.trim() === '') {
      reproducirAudioLocal(currentCard.Ejemplo_Uso);
      return;
    }

    const isCorrect = userInput.trim().toLowerCase() === currentCard.Verbo_Ingles.trim().toLowerCase();

    if (isCorrect) {
      setFeedback('correct');
      setAuditivoCorrectPanel(true);
      sounds.playCorrect();
      setSessionStats(prev => ({ ...prev, successes: prev.successes + 1 }));
    } else {
      setFeedback('wrong');
      sounds.playWrong();
      setAiTip(`El correcto era: ${currentCard.Verbo_Ingles}`);
      setSessionStats(prev => ({ 
        ...prev, 
        errors: prev.errors + 1, 
        errorIds: [...prev.errorIds, currentCard.id] 
      }));

      // Iniciar temporizador automático pero permitir salto manual con ENTER
      auditivoTimeoutRef.current = setTimeout(() => {
        nextAuditivoWord();
      }, 2500);
    }
  };

  const nextAuditivoWord = () => {
    setAiTip(null);
    setAuditivoCorrectPanel(false);
    if (currentIndex < sessionCards.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setUserInput('');
      setFeedback('none');
      setShowAuditivoHint(false);
      const audioToPlay = sessionCards[nextIdx].Verbo_Ingles;
      setTimeout(() => reproducirAudioLocal(audioToPlay), 300);
    } else {
      setMode('results');
    }
  };

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      // Escape global exit
      if (e.key === 'Escape') {
        setMode('menu');
        setShowSettings(false);
        return;
      }

      // ENTER behavior for feedback panels (always active even if typing)
      if (e.key === 'Enter') {
        if (mode === 'survival' && aiTip) {
          continueAfterFail();
          return;
        }
        if (mode === 'auditivo') {
          if (auditivoCorrectPanel) {
            nextAuditivoWord();
            return;
          }
          if (aiTip) {
            if (auditivoTimeoutRef.current) clearTimeout(auditivoTimeoutRef.current);
            nextAuditivoWord();
            return;
          }
        }
      }

      // Don't trigger other shortcuts if user is typing
      if (isTyping) {
        return;
      }

      if (mode === 'menu') {
        if (e.key === '1') startSession();
        if (e.key === '2') startSession(undefined, 'survival');
        if (e.key === '3') startSession(undefined, 'auditivo');
        if (e.key === '4') setMode('reading');
      }

      if (mode === 'flashcards' && !showSettings) {
        if (e.key === ' ') {
          e.preventDefault();
          if (!showAnswer) {
            setShowAnswer(true);
            sounds.playFlip();
          } else {
            handleReview(true);
          }
        }
        if (showAnswer) {
          if (e.key === 'ArrowLeft') handleReview(false);
          if (e.key === 'ArrowRight') handleReview(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, showAnswer, currentIndex, sessionCards, auditivoCorrectPanel, aiTip, showSettings]);

  const boxColors: Record<number, string> = {
    1: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
    2: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
    3: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
    4: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10',
    5: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <RefreshCw className="w-10 h-10 text-indigo-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-all duration-500 ease-in-out"
      style={{ fontSize: fontSizeMap[fontSize] }}
    >
      {/* Sound Toggle Floating */}
      <button 
        onClick={() => setMuted(!muted)}
        className="fixed bottom-8 left-8 z-50 p-4 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-xl text-slate-400 hover:text-indigo-500 transition-all hover:scale-110 active:scale-95"
      >
        {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
      </button>

      {/* Removed Critical Words Widget - Now in Dashboard Stats */}

      <header className="fixed top-0 left-0 w-full h-16 px-8 flex justify-between items-center z-40 bg-[var(--bg-main)]/80 backdrop-blur-md border-b border-[var(--border-main)]">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setMode('menu')}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="font-black uppercase tracking-tighter text-sm">Simply <span className="text-indigo-500">Vocab</span></span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { setSettingsView('main'); setShowSettings(true); }}
            className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowHelp(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2.5rem] p-10 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                  <Info className="w-6 h-6 text-indigo-500" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Bienvenido a Simply Vocab</h3>
              </div>

              <div className="space-y-6 text-slate-400 text-sm leading-relaxed">
                <p>
                  Para comenzar con <span className="text-white font-bold">Simply Vocab</span>, ve a los <span className="text-indigo-400 font-bold">Ajustes (⚙️)</span> en la esquina superior derecha y carga tu lista de verbos.
                </p>
                <p>
                  Puedes subir un archivo <span className="text-emerald-400 font-bold">.json</span> o pegar el texto directamente en la sección "Mi Diccionario".
                </p>
                
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Formato Esperado:</span>
                  <pre className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-main)] text-[10px] font-mono text-indigo-300 overflow-x-auto">
                    {`[`}
                    {`\n  {`}
                    {`\n    "Verbo_Ingles": "Abide by",`}
                    {`\n    "Significado_Espanol": "Cumplir",`}
                    {`\n    "Concepto_Ingles": "Follow rules",`}
                    {`\n    "Ejemplo_Uso": "They are abiding by the laws."`}
                    {`\n  }`}
                    {`\n]`}
                  </pre>
                </div>

                <button 
                   type="button"
                   onClick={() => setShowHelp(false)}
                   className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95 mt-4"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="pt-16 min-h-screen flex flex-col items-center">
        {/* Stats Section & Top Difficult */}
        {mode === 'menu' && (
          <div className="w-full max-w-4xl px-8 mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-6 rounded-3xl flex flex-col items-center justify-center min-h-[160px]">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Diccionario</span>
              <span className="text-3xl font-black text-white">{cards.length}</span>
              <span className="text-[10px] font-bold text-slate-600">Palabras</span>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-6 rounded-3xl flex flex-col items-center justify-center min-h-[160px]">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sesiones</span>
              <span className="text-3xl font-black text-white">{sessionsStarted}</span>
              <span className="text-[10px] font-bold text-slate-600">Iniciadas</span>
            </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-6 rounded-3xl flex flex-col items-center justify-center min-h-[300px]">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Retención</span>
                <div className="chart-container w-full h-[200px] min-w-[200px]">
                  {cards.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          border: '1px solid #1e293b',
                          borderRadius: '8px',
                          fontSize: '10px',
                          color: '#f1f5f9'
                        }}
                        itemStyle={{ color: '#f1f5f9' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-[10px] text-slate-600 italic">Sin datos</div>
                )}
              </div>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[8px] font-bold text-slate-500 uppercase">Ok</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span className="text-[8px] font-bold text-slate-500 uppercase">Repaso</span>
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-6 rounded-3xl min-h-[160px]">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block text-center">Top Dificultad</span>
              <div className="space-y-1.5">
                {topDifficultVerbs.length > 0 ? topDifficultVerbs.map(v => (
                  <div key={v.id} className="flex justify-between items-center bg-[var(--bg-main)] px-3 py-1.5 rounded-xl border border-[var(--border-main)]">
                    <span className="text-[10px] font-bold text-slate-300 truncate w-24">{v.Verbo_Ingles}</span>
                    <span className="text-[8px] font-black text-rose-500">{v.Fallos_Totales} fallos</span>
                  </div>
                )) : <p className="text-[10px] text-slate-500 text-center italic">Sin datos aún</p>}
              </div>
            </div>
          </div>
        )}

        {mode === 'menu' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl w-full p-8 pt-0 flex flex-col items-center"
          >
            <header className="mb-12 text-center mt-8">
              <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">Entrena tu <span className="text-indigo-500">Subconsciente</span></h2>
              <p className="text-slate-500 font-medium italic">Repaso espaciado local.</p>
              
              <button 
                onClick={() => setShowHelp(true)}
                className="mt-6 flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all mx-auto shadow-sm"
              >
                <Info className="w-4 h-4" /> ¿Cómo empezar?
              </button>
            </header>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
              <motion.button 
                whileHover={{ scale: 1.02, translateY: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startSession()}
                className="group relative bg-[var(--bg-card)] border border-[var(--border-main)] p-8 rounded-[2rem] text-left overflow-hidden transition-all hover:border-indigo-500/50"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <RotateCcw className="w-24 h-24" />
                </div>
                <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20">
                  <Sparkles className="w-8 h-8 text-indigo-500" />
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold mb-2">Flashcards</h2>
                    <p className="text-slate-400 text-xs leading-relaxed mb-6">Repaso clásico con autoevaluación.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                  Empezar sesión <ChevronRight className="w-4 h-4" />
                </div>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.02, translateY: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startSession(undefined, 'survival')}
                className="group relative bg-[var(--bg-card)] border border-[var(--border-main)] p-8 rounded-[2rem] text-left overflow-hidden transition-all hover:border-rose-500/50"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Zap className="w-24 h-24" />
                </div>
                <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6 border border-rose-500/20">
                  <Zap className="w-8 h-8 text-rose-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">Supervivencia</h2>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">Escritura rápida contra el tiempo.</p>
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                  Entrar al desafío <ChevronRight className="w-4 h-4" />
                </div>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.02, translateY: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startSession(undefined, 'auditivo')}
                className="group relative bg-[var(--bg-card)] border border-[var(--border-main)] p-8 rounded-[2rem] text-left overflow-hidden transition-all hover:border-blue-500/50"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Volume2 className="w-24 h-24" />
                </div>
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                  <Volume2 className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">Desafío Auditivo</h2>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">Escucha el verbo y escríbelo correctamente.</p>
                <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                  Empezar desafío <ChevronRight className="w-4 h-4" />
                </div>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.02, translateY: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode('reading')}
                className="group relative bg-[var(--bg-card)] border border-[var(--border-main)] p-8 rounded-[2rem] text-left overflow-hidden transition-all hover:border-emerald-500/50"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <BookOpen className="w-24 h-24" />
                </div>
                <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                  <BookOpen className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold mb-2 uppercase tracking-tighter">Modo Lectura</h2>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">Consulta el glosario completo de verbos.</p>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  Explorar glosario <ChevronRight className="w-4 h-4" />
                </div>
              </motion.button>
            </div>

            <div className="mt-8 w-full max-w-sm flex flex-col items-center gap-6">
              <div className="flex items-center gap-4 bg-[var(--bg-card)] border border-[var(--border-main)] px-6 py-3 rounded-2xl">
                <span className={`text-[10px] font-black uppercase tracking-widest ${shuffleEnabled ? 'text-indigo-400' : 'text-slate-500 transition-colors'}`}>Orden Aleatorio</span>
                <button 
                  onClick={() => setShuffleEnabled(!shuffleEnabled)}
                  className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${shuffleEnabled ? 'bg-indigo-600' : 'bg-slate-800'}`}
                >
                  <motion.div 
                    animate={{ x: shuffleEnabled ? 26 : 2 }}
                    className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center">Alcanza la excelencia repasando tus errores.</p>
            </div>
          </motion.div>
        )}
        {mode === 'reading' && (
          <div className="w-full max-w-6xl px-8 py-12">
            <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
              <div className="flex items-center gap-4">
                <button onClick={() => setMode('menu')} className="p-3 bg-slate-800 rounded-2xl text-slate-400 hover:bg-slate-700 hover:text-white transition-all">
                  <RotateCcw className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter">Modo Lectura</h2>
                  <p className="text-slate-500 text-sm font-medium">Glosario de verbos frasales</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-[var(--bg-card)] border border-[var(--border-main)] px-4 py-2 rounded-2xl">
                <ListFilter className="w-4 h-4 text-indigo-500" />
                <select 
                  value={readingSort}
                  onChange={(e) => setReadingSort(e.target.value as any)}
                  className="bg-transparent text-xs font-black uppercase tracking-widest text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="default" className="bg-slate-900">Orden Predeterminado</option>
                  <option value="az" className="bg-slate-900">Alfabético (A - Z)</option>
                  <option value="za" className="bg-slate-900">Alfabético (Z - A)</option>
                </select>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {readingSortedCards.map((card) => (
                <motion.div 
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-8 hover:border-indigo-500/30 transition-all flex flex-col group"
                >
                  <div className="mb-6 flex justify-between items-start">
                    <h3 className="text-2xl font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{card.Verbo_Ingles}</h3>
                    <div className={`p-1.5 rounded-lg ${card.Fallos_Totales > 3 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      <Info className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="space-y-6 flex-1">
                    <div>
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-1">Traducción</span>
                      <p className="text-lg font-bold text-slate-200">{card.Significado_Espanol}</p>
                    </div>

                    {card.Concepto_Ingles && (
                      <div>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Concepto en Inglés</span>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">{card.Concepto_Ingles}</p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-800">
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-2">Ejemplo de Uso</span>
                      <p className="text-sm italic text-slate-400 leading-relaxed font-medium">"{card.Ejemplo_Uso}"</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {cards.length === 0 && (
              <div className="w-full flex flex-col items-center justify-center py-24 opacity-50">
                  <Search className="w-12 h-12 mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">No hay verbos para mostrar</p>
              </div>
            )}
          </div>
        )}

        {mode === 'auditivo' && sessionCards[currentIndex] && (
          <div className={`w-full flex-1 flex flex-col items-center p-4 md:p-6 transition-colors duration-500 ${
            feedback === 'correct' ? 'bg-emerald-950/20' : 
            feedback === 'wrong' ? 'bg-rose-950/20' : ''
          }`}>
            <nav className="w-full max-w-xl flex justify-between items-center mb-8 md:mb-12">
              <button onClick={() => setMode('menu')} className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 font-bold text-[10px] md:text-sm uppercase tracking-widest">
                <RotateCcw className="w-3 h-3 md:w-4 h-4" /> Salir
              </button>
              <div className="bg-[var(--bg-card)] border border-[var(--border-main)] px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[8px] md:text-[10px] font-black text-slate-400">
                {currentIndex + 1} / {sessionCards.length} AUDIO
              </div>
            </nav>

            <main className="w-full max-w-xl flex flex-col items-center">
              <div className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[3rem] p-12 mb-12 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
                <div 
                  className={`w-32 h-32 md:w-48 h-48 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 mb-8 cursor-pointer transition-all active:scale-95 ${isSpeaking ? 'animate-pulse scale-110 shadow-[0_0_30px_rgba(59,130,246,0.3)]' : ''}`}
                  onClick={() => reproducirAudioLocal(sessionCards[currentIndex].Verbo_Ingles)}
                >
                  <Volume2 className={`w-16 h-16 md:w-24 h-24 ${isSpeaking ? 'text-blue-400' : 'text-slate-600'}`} />
                </div>

                <button 
                  onClick={() => reproducirAudioLocal(sessionCards[currentIndex].Verbo_Ingles)}
                  className="px-6 py-2 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all mb-10"
                >
                  Repetir Audio
                </button>

                {!auditivoCorrectPanel ? (
                  <div className="w-full">
                    <div className="flex flex-col items-center mb-6">
                      <button 
                        onClick={() => setShowAuditivoHint(true)}
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 mb-2"
                      >
                        💡 Ver Pista
                      </button>
                      <AnimatePresence>
                        {showAuditivoHint && (
                          <motion.p 
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="text-xs text-slate-400 font-medium text-center bg-indigo-500/5 px-4 py-2 rounded-lg border border-indigo-500/10"
                          >
                            {sessionCards[currentIndex].Concepto_Ingles || "No hay concepto disponible"}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <form onSubmit={handleAuditivoSubmit} className="w-full space-y-6">
                      <div className="relative">
                        <input 
                          type="text"
                          autoFocus
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck="false"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          placeholder="Escribe lo que escuchas..."
                          className={`w-full bg-[var(--bg-main)] border-2 rounded-2xl px-6 py-5 text-xl font-bold text-center focus:outline-none transition-all ${
                            feedback === 'wrong' ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)]' : 'border-[var(--border-main)] focus:border-blue-500'
                          }`}
                        />
                        <button 
                          type="submit"
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-indigo-500 transition-colors"
                        >
                          <Send className="w-6 h-6" />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-600 text-center italic">Presiona ENTER sin texto para recibir una pista de audio (contexto).</p>
                    </form>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-8 flex flex-col items-center gap-6"
                  >
                    <div className="text-center">
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-2">¡Correcto!</span>
                      <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">{sessionCards[currentIndex].Verbo_Ingles}</h3>
                      <div className="space-y-4">
                        <p className="text-xl font-bold text-slate-200">{sessionCards[currentIndex].Significado_Espanol}</p>
                        <p className="text-sm italic text-slate-400 font-medium">"{sessionCards[currentIndex].Ejemplo_Uso}"</p>
                      </div>
                    </div>

                    <button 
                      onClick={nextAuditivoWord}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                      Siguiente Palabra <ChevronRight className="w-5 h-5" />
                    </button>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Presiona ENTER para continuar</p>
                  </motion.div>
                )}

                <AnimatePresence>
                  {aiTip && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute bottom-12 left-10 right-10 bg-rose-500/20 border border-rose-500/30 p-4 rounded-xl text-center"
                    >
                      <p className="text-xs font-black text-rose-400 uppercase tracking-widest mb-1">¡Casi!</p>
                      <p className="text-sm font-bold text-white leading-tight">{aiTip}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-8">
                 <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Aciertos</span>
                    <span className="text-xl font-black text-emerald-500">{sessionStats.successes}</span>
                 </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Errores</span>
                    <span className="text-xl font-black text-rose-500">{sessionStats.errors}</span>
                 </div>
              </div>
            </main>
          </div>
        )}

        {mode === 'flashcards' && (
          <div className="w-full flex-1 flex flex-col items-center p-4 md:p-6">
            <nav className="w-full max-w-xl flex justify-between items-center mb-8 md:mb-12">
              <button onClick={() => setMode('menu')} className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 font-bold text-[10px] md:text-sm uppercase tracking-widest">
                <RotateCcw className="w-3 h-3 md:w-4 h-4" /> Salir
              </button>
              <div className="bg-[var(--bg-card)] border border-[var(--border-main)] px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[8px] md:text-[10px] font-black text-slate-400">
                {currentIndex + 1} / {sessionCards.length} CARDS
              </div>
            </nav>

            <div className="perspective-1000 w-[90%] md:w-full max-w-lg aspect-[4/5] relative">
              <motion.div 
                className="w-full h-full relative transition-transform duration-700 preserve-3d"
                style={{ transform: showAnswer ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
              >
                <div className="absolute inset-0 backface-hidden bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 flex flex-col items-center justify-center text-center shadow-2xl">
                  {sessionCards[currentIndex] && (
                    <>
                  <div className={`px-4 py-1 rounded-full border text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-8 md:mb-12 ${sessionCards[currentIndex].Fallos_Totales > 3 ? 'border-rose-500/30 text-rose-400 bg-rose-500/10' : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'}`}>
                    {sessionCards[currentIndex].Fallos_Totales > 0 ? `Fallos: ${sessionCards[currentIndex].Fallos_Totales}` : '¡Nueva palabra!'}
                  </div>
                      <h1 className="text-3xl md:text-5xl font-black text-[var(--text-main)] tracking-tighter leading-none mb-6 md:mb-8">{sessionCards[currentIndex].Verbo_Ingles}</h1>
                      <p className="text-slate-500 text-sm md:text-base font-medium italic">¿Recuerdas qué significa?</p>
                      <button 
                        onClick={() => { setShowAnswer(true); sounds.playFlip(); }}
                        className="mt-12 md:mt-16 w-full py-4 md:py-5 bg-indigo-600 text-white rounded-2xl md:rounded-3xl font-black text-base md:text-lg hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                      >
                        Voltear Tarjeta
                      </button>
                    </>
                  )}
                </div>
 
                <div 
                  className="absolute inset-0 backface-hidden bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 flex flex-col shadow-2xl"
                  style={{ transform: 'rotateY(180deg)' }}
                >
                  {sessionCards[currentIndex] && (
                    <>
                      <div className="flex-1 overflow-y-auto space-y-6 md:space-y-8 pr-2 scrollbar-hide">
                        <div>
                          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2 block">Definición</span>
                          <h2 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] leading-tight">{sessionCards[currentIndex].Significado_Espanol}</h2>
                        </div>
                        {sessionCards[currentIndex].Concepto_Ingles && (
                          <div>
                            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2 block">English Concept</span>
                            <p className="text-slate-400 text-sm md:text-base font-medium italic leading-relaxed">{sessionCards[currentIndex].Concepto_Ingles}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 block">Example (Present Continuous)</span>
                          <p className="text-slate-400 text-sm md:text-base font-medium italic leading-relaxed md:text-lg">"{sessionCards[currentIndex].Ejemplo_Uso}"</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 md:gap-4 mt-6 md:mt-8">
                        <button 
                          onClick={() => handleReview(false)}
                          className="py-4 md:py-5 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-2xl md:rounded-3xl font-black hover:bg-rose-500/20 transition-all uppercase text-[10px] md:text-xs tracking-widest"
                        >
                          No lo sabía
                        </button>
                        <button 
                          onClick={() => handleReview(true)}
                          className="py-4 md:py-5 bg-emerald-500 text-white rounded-2xl md:rounded-3xl font-black hover:bg-emerald-400 transition-all uppercase text-[10px] md:text-xs tracking-widest shadow-lg shadow-emerald-500/20"
                        >
                          Lo recordé
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {mode === 'survival' && sessionCards[currentIndex] && (
          <div className={`w-full flex-1 transition-colors duration-500 flex flex-col items-center p-4 md:p-6 ${
            feedback === 'correct' ? 'bg-emerald-950/20' : 
            feedback === 'wrong' ? 'bg-rose-950/20' : ''
          }`}>
            <nav className="w-full max-w-2xl flex justify-between items-center mb-6 md:mb-10">
              <div className="flex gap-1.5 md:gap-2">
                {[...Array(3)].map((_, i) => (
                  <Heart key={i} className={`w-5 h-5 md:w-6 h-6 transition-all duration-300 ${i < lives ? 'text-rose-500 fill-rose-500 scale-110' : 'text-slate-800 scale-90'}`} />
                ))}
              </div>
              <div className="bg-[var(--bg-card)] backdrop-blur border border-[var(--border-main)] px-4 py-1.5 md:px-5 md:py-2 rounded-2xl flex flex-col items-center min-w-[80px] md:min-w-[100px]">
                 <span className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5 md:mb-1">Time Left</span>
                 <span className={`text-xl md:text-2xl font-black ${timer < 5 ? 'text-rose-500 animate-pulse' : 'text-[var(--text-main)]'}`}>{timer}s</span>
              </div>
            </nav>

            <main className="flex-1 w-[95%] md:w-full max-w-xl flex flex-col items-center">
              <div className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 mb-6 md:mb-8 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-800">
                  <motion.div 
                    className="h-full bg-indigo-500" 
                    initial={{ width: "100%" }}
                    animate={{ width: `${(timer / 15) * 100}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </div>

                <div className="text-center mb-8 md:mb-12">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3 md:mb-4 block">Escribe el phrasal verb:</span>
                  <h2 className="text-2xl md:text-4xl font-black text-[var(--text-main)] leading-tight uppercase tracking-tighter">
                    {sessionCards[currentIndex].Significado_Espanol}
                  </h2>
                </div>

                <form onSubmit={handleSurvivalSubmit} className="relative mb-4">
                  <input 
                    type="text"
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Escribe en inglés..."
                    className={`w-full bg-[var(--bg-main)] border-2 rounded-[1.5rem] md:rounded-[2rem] px-6 py-4 md:px-8 md:py-6 text-xl md:text-2xl font-bold text-center focus:outline-none transition-all ${
                      feedback === 'correct' ? 'border-emerald-500' : 
                      feedback === 'wrong' ? 'border-rose-500' : 'border-[var(--border-main)] focus:border-indigo-500'
                    }`}
                  />
                </form>

                <AnimatePresence>
                  {aiTip && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-6 md:mt-8 bg-indigo-500/10 border border-indigo-500/20 p-5 md:p-6 rounded-[2rem]"
                    >
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-indigo-400 mt-1 shrink-0" />
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1 md:mb-2">Tip de Aprendizaje</p>
                          <p className="text-slate-300 text-sm leading-relaxed font-bold">{aiTip}</p>
                          <button 
                             onClick={continueAfterFail}
                             className="mt-4 w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95"
                          >
                            Entendido, Continuar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Aciertos consecutivos: {currentIndex}</p>
            </main>
          </div>
        )}

        {mode === 'results' && (
          <div className="min-h-screen w-full bg-[var(--bg-main)] flex flex-col items-center justify-center p-6 text-center absolute inset-0 z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[3rem] p-10 shadow-2xl"
            >
              {lives <= 0 ? (
                <AlertTriangle className="w-16 h-16 text-rose-500 mb-6 mx-auto" />
              ) : (
                <Trophy className="w-16 h-16 text-emerald-500 mb-6 mx-auto" />
              )}
              
              <h1 className="text-4xl font-black text-[var(--text-main)] tracking-tighter uppercase mb-2">
                {lives <= 0 ? '¡Sin Vidas!' : (sessionStats.lastMode === 'survival' ? '¡Supervivencia en Simply Vocab Completada!' : 'Sesión Finalizada')}
              </h1>
              <p className="text-slate-500 mb-8 font-medium">
                {lives <= 0 ? 'Te has quedado sin corazones. ¡Sigue practicando!' : 
                 (sessionStats.lastMode === 'auditivo' ? '¡Tu oído está mejorando día a día!' : '¡Resultados espectaculares! Aquí tienes tu resumen:')}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                  <span className="text-[10px] font-black text-emerald-500 uppercase block mb-1">Aciertos</span>
                  <span className="text-2xl font-black text-emerald-500">{sessionStats.successes}</span>
                </div>
                <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20">
                  <span className="text-[10px] font-black text-rose-500 uppercase block mb-1">Errores</span>
                  <span className="text-2xl font-black text-rose-500">{sessionStats.errors}</span>
                </div>
                {(lives <= 0 || sessionStats.lastMode === 'auditivo') && (
                   <div className="bg-slate-900/50 p-4 rounded-2xl border border-[var(--border-main)] col-span-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Racha Final</span>
                    <span className="text-2xl font-black text-white">{currentIndex}</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <button 
                  type="button"
                  onClick={() => startSession(sessionCards, sessionStats.lastMode === 'survival' && lives <= 0 ? 'survival' : sessionStats.lastMode)}
                  className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                >
                  {lives <= 0 ? 'Volver a Jugar' : 'Repetir Toda la Sesión'}
                </button>
                {sessionStats.errorIds.length > 0 && (lives > 0 || sessionStats.lastMode === 'auditivo') && (
                  <button 
                    type="button"
                    onClick={() => {
                      const errorCards = cards.filter(c => sessionStats.errorIds.includes(c.id));
                      startSession(errorCards, sessionStats.lastMode);
                    }}
                    className="w-full py-5 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-rose-500/20 transition-all active:scale-95"
                  >
                    Repasar Solo Errores
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setMode('menu')}
                  className="w-full py-5 bg-slate-900 text-slate-400 rounded-3xl font-black text-sm uppercase tracking-widest hover:text-white transition-all active:scale-95"
                >
                  Volver al Menú Principal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Settings & Dictionary Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { if(settingsView === 'edit') setSettingsView('dictionary'); else setShowSettings(false); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[3rem] flex flex-col max-h-[85vh] overflow-hidden shadow-2xl"
            >
              {/* Settings Header */}
              <div className="px-10 pt-10 pb-6 border-b border-[var(--border-main)] flex justify-between items-center bg-[var(--bg-card)]/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  {settingsView !== 'main' && (
                    <button onClick={() => setSettingsView('main')} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <h3 className="text-2xl font-black uppercase tracking-tighter">
                    {settingsView === 'main' ? 'Ajustes' : settingsView === 'dictionary' ? 'Mi Diccionario' : 'Editar Verbo'}
                  </h3>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Settings Content */}
              <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                <AnimatePresence mode="wait">
                  {settingsView === 'main' && (
                    <motion.div 
                      key="main-settings"
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                      className="space-y-8"
                    >
                      <button 
                        type="button"
                        onClick={() => setSettingsView('add')}
                        className="w-full py-4 mb-4 bg-indigo-600/10 border border-indigo-500/30 text-indigo-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Añadir Verbo Manualmente
                      </button>

                      <button 
                        type="button"
                        onClick={() => setSettingsView('dictionary')}
                        className="w-full p-6 bg-slate-900/50 border border-slate-800 rounded-3xl flex justify-between items-center group hover:border-indigo-500/50 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 text-indigo-500">
                             <BookOpen className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-bold text-slate-200">Gestionar Verbos</h4>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{cards.length} palabras guardadas</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-500 transition-all" />
                      </button>

                      <div className="space-y-6 pt-4">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 block">Tema</label>
                            <div className="flex gap-2">
                              {['light', 'dark'].map(t => (
                                <button key={t} type="button" onClick={() => setTheme(t as any)} className={`flex-1 py-3 rounded-2xl border font-bold capitalize transition-all ${theme === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{t}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 block">Fuente</label>
                            <div className="flex gap-2">
                              {['small', 'normal', 'large'].map(sz => (
                                <button key={sz} type="button" onClick={() => setFontSize(sz as any)} className={`flex-1 py-3 rounded-2xl border font-bold capitalize transition-all ${fontSize === sz ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{sz[0]}</button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={(e) => handleDeleteAll(e)}
                          className="w-full py-4 mt-8 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Borrar Todos los Datos
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {settingsView === 'add' && (
                    <motion.div 
                      key="add-form"
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="space-y-6"
                    >
                      <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-2xl mb-4">
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-2">Instrucciones</p>
                        <p className="text-[11px] text-slate-400">Ingresa los datos para añadir un nuevo phrasal verb al diccionario.</p>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Verbo en forma base (Ej: Get up)</label>
                        <input 
                          value={newVerb.ingles} 
                          onChange={e => setNewVerb({...newVerb, ingles: e.target.value})} 
                          placeholder="Base form"
                          className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-indigo-500" 
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Present Continuous (Ej: Getting up)</label>
                        <input 
                          value={newVerb.continuous} 
                          onChange={e => setNewVerb({...newVerb, continuous: e.target.value})} 
                          placeholder="Specifically Present Continuous"
                          className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-indigo-500" 
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Traducción al español</label>
                        <input 
                          value={newVerb.espanol} 
                          onChange={e => setNewVerb({...newVerb, espanol: e.target.value})} 
                          placeholder="Traducción"
                          className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-indigo-500" 
                        />
                      </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    if (!newVerb.ingles || !newVerb.continuous || !newVerb.espanol) {
                      alert("Completa todos los campos obligatorios.");
                      return;
                    }
                    const verbToAdd: PhrasalVerb = {
                      id: Math.random().toString(36).substr(2, 9),
                      Verbo_Ingles: newVerb.ingles,
                      Significado_Espanol: newVerb.espanol,
                      Concepto_Ingles: '', // Optional or inferred
                      Ejemplo_Uso: `I am ${newVerb.continuous} right now.`, // Basic template
                      Fallos_Totales: 0
                    };
                    setCards(prev => [...prev, verbToAdd]);
                    setNewVerb({ ingles: '', continuous: '', espanol: '' });
                    setSettingsView('dictionary');
                  }} 
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
                >
                  Guardar Verbo
                </button>
                        <button 
                          type="button" 
                          onClick={() => setSettingsView('main')} 
                          className="flex-1 py-4 bg-slate-800 text-slate-300 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {settingsView === 'dictionary' && (
                    <motion.div 
                      key="dictionary"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <button 
                          type="button"
                          onClick={handleExportJson}
                          className="flex items-center justify-center gap-2 py-4 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                        >
                          <FileDown className="w-4 h-4" /> Exportar .json
                        </button>
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center justify-center gap-2 py-4 bg-indigo-600/10 border border-indigo-500/30 text-indigo-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        >
                          <FileUp className="w-4 h-4" /> Importar .json
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleImportFile} 
                          accept=".json" 
                          className="hidden" 
                        />
                      </div>

                      <div className="space-y-4 pt-4 border-t border-[var(--border-main)]">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">O pega tu código JSON directamente aquí...</label>
                         <textarea 
                           rows={6}
                           value={jsonInput}
                           onChange={(e) => setJsonInput(e.target.value)}
                           placeholder={`[ { "Verbo_Ingles": "Abide by", ... } ]`}
                           className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 transition-all resize-none"
                         />
                         <button 
                            type="button"
                            onClick={handleImportFromText}
                            className="w-full py-4 bg-indigo-600/10 border border-indigo-500/20 text-indigo-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                         >
                            <Plus className="w-4 h-4" /> Añadir Verbos desde Texto
                         </button>
                      </div>

                      <div className="pt-4 border-t border-[var(--border-main)]">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-4">Lista de Verbos</label>
                        {cards.length === 0 ? (
                        <div className="text-center py-20">
                          <BookOpen className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                          <p className="text-slate-500 italic">No tienes verbos guardados.</p>
                        </div>
                      ) : (
                        cards.map(v => (
                          <div key={v.id} className={`p-4 md:p-5 border rounded-[1.5rem] md:rounded-[2rem] flex justify-between items-center transition-all ${v.activo === false ? 'bg-slate-900/20 border-slate-900 opacity-60' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${v.Fallos_Totales > 3 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
                              <div>
                                <h4 className={`font-bold text-sm md:text-base ${v.activo === false ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{v.Verbo_Ingles}</h4>
                                <p className="text-[10px] md:text-xs text-slate-500">{v.Significado_Espanol}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                               {/* Toggle Switch */}
                               <div className="flex items-center">
                                 <button 
                                   type="button"
                                   onClick={() => toggleActiveVerb(v.id)}
                                   className={`w-10 h-5 rounded-full relative transition-colors ${v.activo !== false ? 'bg-emerald-600' : 'bg-slate-800'}`}
                                 >
                                   <motion.div 
                                     animate={{ x: v.activo !== false ? 22 : 2 }}
                                     className="absolute top-1 left-0 w-3 h-3 bg-white rounded-full shadow-md"
                                   />
                                 </button>
                               </div>

                               <div className="flex gap-1">
                                 <button 
                                   type="button"
                                   onClick={() => { setEditingVerb({...v}); setSettingsView('edit'); }}
                                   className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                                 >
                                   <Edit3 className="w-3.5 h-3.5" />
                                 </button>
                                 <button 
                                   type="button"
                                   onClick={(e) => handleDeleteVerb(e, v.id)}
                                   className="p-2 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               </div>
                            </div>
                          </div>
                        ))
                      )}
                      </div>
                    </motion.div>
                  )}

                  {settingsView === 'edit' && editingVerb && (
                    <motion.form 
                      key="edit-form"
                      onSubmit={handleEditSave}
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="space-y-6"
                    >
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Verbo Inglés</label>
                        <input value={editingVerb.Verbo_Ingles} onChange={e => setEditingVerb({...editingVerb, Verbo_Ingles: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Significado Español</label>
                        <input value={editingVerb.Significado_Espanol} onChange={e => setEditingVerb({...editingVerb, Significado_Espanol: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Ejemplo (Present Continuous)</label>
                        <textarea value={editingVerb.Ejemplo_Uso} onChange={e => setEditingVerb({...editingVerb, Ejemplo_Uso: e.target.value})} rows={2} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white" />
                      </div>
                      <div className="flex gap-4 pt-4">
                        <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">Guardar Cambios</button>
                        <button type="button" onClick={() => setSettingsView('dictionary')} className="flex-1 py-4 bg-slate-800 text-slate-300 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">Cancelar</button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="w-full py-12 mt-auto text-center opacity-40 select-none">
        <p className="text-[10px] font-sans uppercase tracking-[0.2em] font-medium text-slate-500 mb-2">Simply Vocab &copy; 2026</p>
        <p className="text-[8px] font-sans uppercase tracking-[0.1em] font-medium text-slate-600">Entrena tu mente, domina el idioma</p>
      </footer>

      <style>{`
        :root {
          --bg-main: #020617;
          --bg-card: #0f172a;
          --text-main: #f1f5f9;
          --border-main: #1e293b;
        }
        [data-theme="light"] {
          --bg-main: #f8fafc;
          --bg-card: #ffffff;
          --text-main: #0f172a;
          --border-main: #e2e8f0;
        }
        .perspective-1000 { perspective: 1000px; }
        .backface-hidden { backface-visibility: hidden; }
        .preserve-3d { transform-style: preserve-3d; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
