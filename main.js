        // --- VARIABLES DE ESTADO ---
        let currentBoard = [];
        let initialBoard = [];
        let seconds = 0;
        let timerInterval = null;
        let paused = false;
        let selectedCellCoords = null; // {r, c}
        let todayString = "";
        let puzzleIndex = 0;
        let gameWon = false;

        // --- INICIALIZACIÓN Y LÓGICA DIARIA ---
        function init() {
            const date = new Date();
            todayString = date.toISOString().split('T')[0];

            // Calcular el número de día del año para rotar puzzles
            const start = new Date(date.getFullYear(), 0, 0);
            const diff = date - start;
            const oneDay = 1000 * 60 * 60 * 24;
            const dayOfYear = Math.floor(diff / oneDay);

            puzzleIndex = dayOfYear % database.length;
            document.getElementById('reto-title').innerText = `Reto #${dayOfYear}`;

            initialBoard = database[puzzleIndex];

            loadGame();
            drawGrid();
            validateBoard();
            if (!gameWon) startTimer();
        }

        function loadGame() {
            const savedData = localStorage.getItem(`cincoku_${todayString}`);
            if (savedData) {
                const parsed = JSON.parse(savedData);
                currentBoard = parsed.board;
                seconds = parsed.time;
                gameWon = parsed.won || false;
                if (gameWon) showWinScreen();
            } else {
                // Limpiar días anteriores y clonar tablero inicial
                localStorage.clear();
                currentBoard = JSON.parse(JSON.stringify(initialBoard));
                seconds = 0;
                gameWon = false;
                saveGame();
            }
        }

        function saveGame() {
            const state = { board: currentBoard, time: seconds, won: gameWon };
            localStorage.setItem(`cincoku_${todayString}`, JSON.stringify(state));
        }

        function restartGame() {
            if (confirm("¿Seguro que quieres borrar tu progreso de hoy y empezar de cero?")) {
                localStorage.removeItem(`cincoku_${todayString}`);
                
                // Reiniciar estado
                currentBoard = JSON.parse(JSON.stringify(initialBoard));
                seconds = 0;
                gameWon = false;
                selectedCellCoords = null;
                
                // Quitar del modo pausa
                paused = false;
                document.getElementById('pause-overlay').style.display = 'none';
                document.getElementById('grid').style.filter = 'none';
                const errorMsgEl = document.getElementById('error-msg');
                if (errorMsgEl) errorMsgEl.style.display = 'none';
                
                // Repintar UI y reiniciar tempo
                drawGrid();
                updateTimerDisplay();
                startTimer();
                saveGame();
            }
        }

        // --- RENDERIZADO DE LA CUADRÍCULA ---
        function drawGrid() {
            const gridEl = document.getElementById('grid');
            gridEl.innerHTML = ''; // Limpiar

            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    cell.id = `cell-${r}-${c}`;

                    // Aplicar bordes gruesos según el mapa de zonas
                    if (c < 4 && regions[r][c] !== regions[r][c + 1]) cell.classList.add('border-r');
                    if (r < 4 && regions[r][c] !== regions[r + 1][c]) cell.classList.add('border-b');

                    // Fondo de cruz central
                    if (regions[r][c] === 2) cell.classList.add('cross');

                    // Rellenar números
                    const val = currentBoard[r][c];
                    if (val !== 0) cell.innerText = val;
                    if (initialBoard[r][c] !== 0) cell.classList.add('hint');

                    cell.onclick = () => selectCell(r, c);
                    gridEl.appendChild(cell);
                }
            }
        }

        // --- INTERACCIÓN ---
        function selectCell(r, c) {
            if (initialBoard[r][c] !== 0 || paused || gameWon) return; // No editable

            document.querySelectorAll('.cell').forEach(el => el.classList.remove('selected'));
            const cellEl = document.getElementById(`cell-${r}-${c}`);
            cellEl.classList.add('selected');
            selectedCellCoords = { r, c };
        }

        function inputNum(n) {
            if (!selectedCellCoords || paused || gameWon) return;
            const { r, c } = selectedCellCoords;

            currentBoard[r][c] = n;
            const cellEl = document.getElementById(`cell-${r}-${c}`);
            cellEl.innerText = n === 0 ? "" : n;

            validateBoard();
            saveGame();
            checkWinCondition();
        }

        // --- LÓGICA Y VALIDACIÓN ---
        function validateBoard() {
            let hasErrors = false;

            // Validar Filas y Columnas
            for (let i = 0; i < 5; i++) {
                const rowSeen = new Set();
                const colSeen = new Set();
                for (let j = 0; j < 5; j++) {
                    // Filas
                    const rVal = currentBoard[i][j];
                    if (rVal !== 0) {
                        if (rowSeen.has(rVal)) {
                            hasErrors = true;
                        } else { rowSeen.add(rVal); }
                    }
                    // Columnas
                    const cVal = currentBoard[j][i];
                    if (cVal !== 0) {
                        if (colSeen.has(cVal)) {
                            hasErrors = true;
                        } else { colSeen.add(cVal); }
                    }
                }
            }

            // Validar Zonas (0 al 4)
            for (let z = 0; z < 5; z++) {
                const zoneSeen = new Set();
                for (let r = 0; r < 5; r++) {
                    for (let c = 0; c < 5; c++) {
                        if (regions[r][c] === z) {
                            const val = currentBoard[r][c];
                            if (val !== 0) {
                                if (zoneSeen.has(val)) {
                                    hasErrors = true;
                                } else {
                                    zoneSeen.add(val);
                                }
                            }
                        }
                    }
                }
            }
            return !hasErrors;
        }

        function checkWinCondition() {
            // Comprobar si hay ceros
            let isFull = true;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    if (currentBoard[r][c] === 0) isFull = false;
                }
            }

            const errorMsgEl = document.getElementById('error-msg');
            if (errorMsgEl) errorMsgEl.style.display = 'none';

            if (isFull) {
                if (validateBoard()) {
                    gameWon = true;
                    clearInterval(timerInterval);
                    saveGame();
                    showWinScreen();
                } else {
                    if (errorMsgEl) errorMsgEl.style.display = 'block';
                }
            }
        }

        // --- CRONÓMETRO Y UI ---
        function startTimer() {
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                if (!paused && !gameWon) {
                    seconds++;
                    updateTimerDisplay();
                    if (seconds % 5 === 0) saveGame(); // Guardar tiempo cada 5 seg por si cierran la app
                }
            }, 1000);
            updateTimerDisplay();
        }

        function updateTimerDisplay() {
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            document.getElementById('timer').innerText = `${m}:${s}`;
        }

        function togglePause() {
            if (gameWon) return;
            paused = !paused;
            document.getElementById('pause-overlay').style.display = paused ? 'flex' : 'none';
            document.getElementById('grid').style.filter = paused ? 'blur(4px)' : 'none';
        }

        function showWinScreen() {
            document.getElementById('grid').style.filter = 'blur(4px)';
            const overlay = document.getElementById('win-overlay');
            overlay.style.display = 'flex';

            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            document.getElementById('win-time-text').innerText = `He completado el cincoku en ${m}:${s}`;

            // Deseleccionar celdas
            document.querySelectorAll('.cell').forEach(el => el.classList.remove('selected'));
            selectedCellCoords = null;
        }

        function shareResult() {
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            const textToShare = `🧩 He completado el Cincoku (Reto #${document.getElementById('reto-title').innerText.split('#')[1]}) en ${m}:${s} segundos. ¡Inténtalo tú también!`;

            navigator.clipboard.writeText(textToShare).then(() => {
                alert("¡Copiado al portapapeles!");
            }).catch(err => {
                alert("No se pudo copiar. Tu tiempo es: " + `${m}:${s}`);
            });
        }

        // Arrancar el juego
        init();
