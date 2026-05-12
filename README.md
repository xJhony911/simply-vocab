# Simply Vocab 🧠⚡

**[Prueba la aplicación en vivo aquí](https://simply-vocab.netlify.app/)**

Simply Vocab es una aplicación web interactiva diseñada para acelerar el aprendizaje de vocabulario en inglés mediante el **Sistema Leitner** (repetición espaciada) y mecánicas de gamificación. Construida con un enfoque estricto en la experiencia de usuario (UX) y un diseño moderno con temática oscura/neón.

## ✨ Características Principales

* **Entrenamiento Subconsciente (Sistema Leitner):** Algoritmo de repetición espaciada que prioriza las palabras que más te cuestan, optimizando el tiempo de estudio.
* **4 Modos de Aprendizaje:**
  * 📇 *Flashcards:* Autoevaluación clásica.
  * ⚡ *Supervivencia:* Escritura rápida contrarreloj para poner a prueba la memoria muscular.
  * 🔊 *Desafío Auditivo:* Integración con la Web Speech API para entrenar el *listening* y la ortografía.
  * 📖 *Modo Lectura:* Glosario completo para consultas rápidas.
* **Panel de Estadísticas:** Gráficas de retención dinámicas para visualizar el progreso de aprendizaje en tiempo real.
* **Privacidad y Velocidad (Local First):** Toda la base de datos de palabras y el progreso del usuario se gestionan de forma segura en el navegador mediante `localStorage`. Sin bases de datos externas, fricción cero.
* **Gestión de Datos Flexible:** Permite la importación y exportación masiva de vocabulario mediante archivos `.json` o pegado directo de texto, además de incluir un sistema de "Soft Delete" (activar/desactivar palabras).

## 🛠️ Tecnologías Utilizadas

* **Frontend:** React, TypeScript, HTML5, CSS3.
* **Herramientas de Construcción:** Vite (por su extrema rapidez en desarrollo y compilación optimizada).
* **Visualización de Datos:** Chart.js.
* **Despliegue:** Netlify.

## 🚀 Instalación Local (Para Desarrolladores)

Si deseas clonar este proyecto y ejecutarlo en tu máquina local:

1. Clona el repositorio:
   ```bash
   git clone https://github.com/xJhony911/simply-vocab
2. Navega al directorio del proyecto:
   cd simply-vocab
3. Instala las dependencias necesarias:
   npm install
4. npm run dev
📂 Estructura de Datos (Formato JSON)
La aplicación acepta listas personalizadas de vocabulario con la siguiente estructura de objetos:
[
  {
    "id": "1",
    "Verbo_Ingles": "Abide by",
    "Significado_Espanol": "Acatar / Cumplir",
    "Concepto_Ingles": "To accept or act in accordance with a rule, decision, or recommendation.",
    "Ejemplo_Uso": "You must abide by the rules of the game.",
    "Caja_Leitner": 1,
    "activo": true
  }
]
