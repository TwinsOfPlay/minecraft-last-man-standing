const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 5500;

const TOTAL_ROUNDS = 3;
const MAX_PLAYERS = 16;
const NENNEN_TIME = 30;

const rooms = new Map();
const clients = new Set();

const playersById = new Map();
const playersByIdentity = new Map();

/* =========================================================
   FRAGEN
   ========================================================= */

const quizQuestions = [
    {
        question: "Wie viele Herzen hat ein Spieler in Minecraft?",
        answers: [
            "5",
            "10",
            "20",
            "40"
        ],
        correct: 1
    },
    {
        question: "Welches Erz ist am seltensten in der normalen Oberwelt?",
        answers: [
            "Kohle",
            "Eisen",
            "Diamant",
            "Gold"
        ],
        correct: 2
    },
    {
        question: "Wie heißt die Dimension mit den Endermen?",
        answers: [
            "Nether",
            "End",
            "Aether",
            "Deep Dark"
        ],
        correct: 1
    },
    {
        question: "Wie viele Obsidianblöcke benötigt ein normales Netherportal mindestens?",
        answers: [
            "8",
            "10",
            "12",
            "14"
        ],
        correct: 1
    },
    {
        question: "Welcher Mob explodiert?",
        answers: [
            "Zombie",
            "Skelett",
            "Creeper",
            "Spinne"
        ],
        correct: 2
    },
    {
        question: "Welches Item benötigt man, um ein Endportal zu aktivieren?",
        answers: [
            "Enderperle",
            "Auge des Enders",
            "Netherstern",
            "Endstein"
        ],
        correct: 1
    },
    {
        question: "Wie viele Diamanten benötigt man für eine vollständige Diamantrüstung?",
        answers: [
            "18",
            "24",
            "27",
            "32"
        ],
        correct: 1
    },
    {
        question: "Was droppt ein Creeper normalerweise?",
        answers: [
            "Pfeile",
            "Schießpulver",
            "Knochen",
            "Fäden"
        ],
        correct: 1
    },
    {
        question: "Welcher Block kann einen Leuchtturm aktivieren?",
        answers: [
            "Stein",
            "Eisenblock",
            "Erde",
            "Sandstein"
        ],
        correct: 1
    },
    {
        question: "Wie viele Bücherregale braucht ein Verzauberungstisch für maximale Verzauberungen?",
        answers: [
            "10",
            "12",
            "15",
            "18"
        ],
        correct: 2
    }
];

const estimateQuestions = [
    {
        question: "Wie hoch ist ein normaler Spieler-Sprung in Blöcken?",
        answer: 1.25
    },
    {
        question: "Wie viele Blöcke kann Wasser sich in der Oberwelt horizontal ausbreiten?",
        answer: 7
    },
    {
        question: "Wie viele Herzen hat ein normaler Creeper?",
        answer: 10
    },
    {
        question: "Wie viele Slots hat eine normale große Truhe?",
        answer: 54
    },
    {
        question: "Wie viele Obsidianblöcke hat ein Netherportal mindestens?",
        answer: 10
    },
    {
        question: "Wie viele Enderperlen benötigt man maximal für ein Eye of Ender?",
        answer: 1
    },
    {
        question: "Wie viele Erfahrungspunkte bekommt man ungefähr für das Töten eines normalen Zombies?",
        answer: 5
    },
    {
        question: "Wie viele Blöcke ist ein Stack maximal?",
        answer: 64
    },
    {
        question: "Wie viele Minuten dauert ein kompletter Minecraft-Tag?",
        answer: 20
    },
    {
        question: "Wie viele Slots besitzt ein normales Inventar ohne Hotbar?",
        answer: 27
    }
];

const nennenWords = [
    "Baum",
    "Stein",
    "Eisen",
    "Diamant",
    "Zombie",
    "Creeper",
    "Dorf",
    "Nether",
    "Enderdrache",
    "Schaf",
    "Kuh",
    "Schwein",
    "Bogen",
    "Schwert",
    "Spitzhacke",
    "Fackel",
    "Ofen",
    "Truhe",
    "Crafting Table",
    "Redstone",
    "Gold",
    "Obsidian",
    "Sand",
    "Glas",
    "Wasser"
];

/* =========================================================
   HILFSFUNKTIONEN
   ========================================================= */

function randomId() {
    return crypto.randomUUID();
}

function randomRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    do {
        code = "";

        for (let i = 0; i < 5; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
    } while (rooms.has(code));

    return code;
}

function shuffle(array) {
    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function safeName(name) {
    return String(name || "Spieler")
        .trim()
        .replace(/[<>]/g, "")
        .slice(0, 20) || "Spieler";
}

/*
    Regel:
    - Normale Spieler sind aktiv.
    - Der Besitzer ist nur aktiv, wenn playing === true.
*/
function isPlayerActive(player) {
    if (!player) return false;

    if (!player.owner) {
        return true;
    }

    return player.playing === true;
}

function getActivePlayers(room) {
    return room.players.filter(player => isPlayerActive(player));
}

function getConnectedActivePlayers(room) {
    return getActivePlayers(room).filter(
        player => player.connections.size > 0
    );
}

function getPlayerBySocket(socket) {
    return socket.playerId
        ? playersById.get(socket.playerId) || null
        : null;
}

function getRoomOfPlayer(player) {
    if (!player?.roomCode) return null;

    return rooms.get(player.roomCode) || null;
}

/* =========================================================
   BROADCAST
   ========================================================= */

function send(socket, payload) {
    if (!socket) return;

    if (socket.readyState !== WebSocket.OPEN) return;

    try {
        socket.send(JSON.stringify(payload));
    } catch (error) {
        console.error("Sendefehler:", error);
    }
}

function broadcast(room, payload) {
    if (!room) return;

    for (const player of room.players) {
        for (const socket of player.connections) {
            send(socket, payload);
        }
    }
}

function sendError(socket, message) {
    send(socket, {
        type: "error",
        message
    });
}

/* =========================================================
   ROOM STATE
   ========================================================= */

function serializePlayer(player) {
    return {
        id: player.id,
        name: player.name,
        owner: player.owner,
        playing: player.owner ? player.playing === true : true,
        connected: player.connections.size > 0,
        score: player.score || 0
    };
}

function buildRoomState(room) {
    return {
        type: "state",
        phase: room.phase,
        roomCode: room.code,
        ownerId: room.ownerId,
        category: room.category,
        round: room.round,
        totalRounds: room.totalRounds,
        players: room.players.map(serializePlayer),

        game: {
            word: room.game?.word || null,
            currentPlayerId: room.game?.currentPlayerId || null,
            currentPlayerName: room.game?.currentPlayerName || null,
            timeLeft: room.game?.timeLeft ?? null,

            question: room.game?.question || null,
            answers: room.game?.answers || null,
            questionNumber: room.game?.questionNumber || null,
            totalQuestions: room.game?.totalQuestions || null,

            estimateQuestion:
                room.game?.estimateQuestion || null,

            submitted:
                room.game?.submitted || {}
        },

        results: room.results || [],
        winner: room.winner || null
    };
}

function broadcastState(room) {
    broadcast(room, buildRoomState(room));
}

/* =========================================================
   ROOM LIFECYCLE
   ========================================================= */

function createRoom(ownerPlayer) {
    const room = {
        code: randomRoomCode(),

        ownerId: ownerPlayer.id,

        players: [],

        phase: "lobby",

        category: null,

        round: 0,

        totalRounds: TOTAL_ROUNDS,

        game: null,

        results: [],

        winner: null,

        timer: null,

        turnTimer: null
    };

    ownerPlayer.owner = true;
    ownerPlayer.playing = true;
    ownerPlayer.roomCode = room.code;
    ownerPlayer.score = 0;

    room.players.push(ownerPlayer);

    rooms.set(room.code, room);

    return room;
}

function removePlayerFromRoom(player, room) {
    if (!player || !room) return;

    const index = room.players.findIndex(
        p => p.id === player.id
    );

    if (index !== -1) {
        room.players.splice(index, 1);
    }

    player.roomCode = null;

    if (player.owner) {
        closeRoom(room);
    }
}

function closeRoom(room) {
    if (!room) return;

    clearRoomTimers(room);

    for (const player of room.players) {
        player.roomCode = null;

        for (const socket of player.connections) {
            send(socket, {
                type: "room_closed",
                message: "Der Raum wurde geschlossen."
            });
        }
    }

    rooms.delete(room.code);
}

function clearRoomTimers(room) {
    if (!room) return;

    if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
    }

    if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
    }
}

/* =========================================================
   SPIELSTART
   ========================================================= */

function startGame(room, category) {
    clearRoomTimers(room);

    const activePlayers = getActivePlayers(room);

    /*
        WICHTIG:
        Es müssen IMMER mindestens 2 aktive Spieler sein.
    */
    if (activePlayers.length < 2) {
        return {
            ok: false,
            error: "Mindestens 2 aktive Spieler werden benötigt."
        };
    }

    room.category = category;
    room.round = 1;
    room.results = [];
    room.winner = null;

    for (const player of room.players) {
        player.score = 0;
    }

    if (category === "nennen") {
        prepareNennenRound(room);
    } else if (category === "quiz") {
        prepareQuizRound(room);
    } else if (category === "estimate") {
        prepareEstimateRound(room);
    } else {
        return {
            ok: false,
            error: "Unbekannte Kategorie."
        };
    }

    return {
        ok: true
    };
}

/* =========================================================
   NENNEN
   ========================================================= */

function prepareNennenRound(room) {
    clearRoomTimers(room);

    room.phase = "nennen";

    const activePlayers = getConnectedActivePlayers(room);

    if (activePlayers.length < 2) {
        finishCurrentRound(room);
        return;
    }

    const shuffledPlayers = shuffle(activePlayers);

    room.game = {
        word:
            nennenWords[
                Math.floor(Math.random() * nennenWords.length)
            ],

        currentPlayerId: shuffledPlayers[0].id,

        currentPlayerName: shuffledPlayers[0].name,

        timeLeft: NENNEN_TIME,

        submitted: {},

        turnIndex: 0
    };

    startNennenTimer(room);

    broadcastState(room);
}

function startNennenTimer(room) {
    clearInterval(room.timer);

    room.timer = setInterval(() => {
        if (!room.game) return;

        room.game.timeLeft--;

        broadcastState(room);

        if (room.game.timeLeft <= 0) {
            clearInterval(room.timer);
            room.timer = null;

            handleNennenTimeout(room);
        }
    }, 1000);
}

function handleNennenTimeout(room) {
    const activePlayers = getConnectedActivePlayers(room);

    if (activePlayers.length < 2) {
        finishCurrentRound(room);
        return;
    }

    /*
        Bei Timeout verliert der aktuelle Spieler
        die Runde.
    */
    const currentPlayer = room.players.find(
        player =>
            player.id === room.game?.currentPlayerId
    );

    if (currentPlayer) {
        currentPlayer.score = Math.max(
            0,
            currentPlayer.score - 1
        );
    }

    finishCurrentRound(room);
}

function handleNennenAnswer(player, answer) {
    const room = getRoomOfPlayer(player);

    if (!room || room.phase !== "nennen") {
        return;
    }

    const game = room.game;

    if (!game) return;

    if (game.currentPlayerId !== player.id) {
        sendError(
            [...player.connections][0],
            "Du bist gerade nicht an der Reihe."
        );
        return;
    }

    const normalizedAnswer = String(answer || "")
        .trim()
        .toLowerCase();

    if (!normalizedAnswer) {
        return;
    }

    if (
        game.submitted &&
        game.submitted[player.id]
    ) {
        return;
    }

    game.submitted[player.id] = normalizedAnswer;

    /*
        Die Runde gilt als geschafft, wenn eine gültige
        Antwort abgegeben wurde.
    */
    const expectedWord = String(game.word || "")
        .trim()
        .toLowerCase();

    if (
        normalizedAnswer === expectedWord
    ) {
        player.score += 1;

        finishCurrentRound(room);
    } else {
        /*
            Falsche Antwort beendet die Runde.
        */
        finishCurrentRound(room);
    }
}

/* =========================================================
   QUIZ
   ========================================================= */

function prepareQuizRound(room) {
    clearRoomTimers(room);

    room.phase = "quiz";

    const selected = shuffle(quizQuestions).slice(
        0,
        Math.min(5, quizQuestions.length)
    );

    room.game = {
        questions: selected,
        questionIndex: 0,

        question:
            selected[0]?.question || "",

        answers:
            selected[0]?.answers || [],

        correct:
            selected[0]?.correct ?? null,

        questionNumber: 1,

        totalQuestions: selected.length,

        submitted: {}
    };

    broadcastState(room);
}

function handleQuizAnswer(player, answerIndex) {
    const room = getRoomOfPlayer(player);

    if (!room || room.phase !== "quiz") {
        return;
    }

    if (!room.game) return;

    const index = Number(answerIndex);

    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= room.game.answers.length
    ) {
        return;
    }

    if (
        room.game.submitted &&
        room.game.submitted[player.id]
    ) {
        return;
    }

    room.game.submitted[player.id] = true;

    const isCorrect =
        index === room.game.correct;

    if (isCorrect) {
        player.score += 1;
    }

    const activePlayers =
        getConnectedActivePlayers(room);

    const allSubmitted =
        activePlayers.length > 0 &&
        activePlayers.every(
            p => room.game.submitted[p.id]
        );

    broadcastState(room);

    if (allSubmitted) {
        advanceQuizQuestion(room);
    }
}

function advanceQuizQuestion(room) {
    if (!room.game) return;

    room.game.questionIndex++;

    if (
        room.game.questionIndex >=
        room.game.questions.length
    ) {
        finishCurrentRound(room);
        return;
    }

    const next =
        room.game.questions[
            room.game.questionIndex
        ];

    room.game.question = next.question;
    room.game.answers = next.answers;
    room.game.correct = next.correct;
    room.game.questionNumber =
        room.game.questionIndex + 1;
    room.game.submitted = {};

    broadcastState(room);
}

/* =========================================================
   ESTIMATE
   ========================================================= */

function prepareEstimateRound(room) {
    clearRoomTimers(room);

    room.phase = "estimate";

    const selected = shuffle(estimateQuestions).slice(
        0,
        Math.min(5, estimateQuestions.length)
    );

    room.game = {
        questions: selected,
        questionIndex: 0,

        estimateQuestion:
            selected[0]?.question || "",

        correctEstimate:
            selected[0]?.answer ?? null,

        questionNumber: 1,

        totalQuestions: selected.length,

        submitted: {},

        answers: {}
    };

    broadcastState(room);
}

function handleEstimateAnswer(player, value) {
    const room = getRoomOfPlayer(player);

    if (!room || room.phase !== "estimate") {
        return;
    }

    if (!room.game) return;

    if (
        room.game.submitted &&
        room.game.submitted[player.id]
    ) {
        return;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return;
    }

    const correct =
        Number(room.game.correctEstimate);

    if (!Number.isFinite(correct)) {
        return;
    }

    const difference =
        Math.abs(numericValue - correct);

    const percentDifference =
        correct === 0
            ? difference === 0
                ? 0
                : Infinity
            : (difference / Math.abs(correct)) * 100;

    let points = 0;

    if (difference === 0) {
        points = 3;
    } else if (percentDifference <= 5) {
        points = 2;
    } else if (percentDifference <= 15) {
        points = 1;
    }

    player.score += points;

    room.game.submitted[player.id] = true;

    room.game.answers[player.id] = numericValue;

    const activePlayers =
        getConnectedActivePlayers(room);

    const allSubmitted =
        activePlayers.length > 0 &&
        activePlayers.every(
            p => room.game.submitted[p.id]
        );

    broadcastState(room);

    if (allSubmitted) {
        advanceEstimateQuestion(room);
    }
}

function advanceEstimateQuestion(room) {
    if (!room.game) return;

    room.game.questionIndex++;

    if (
        room.game.questionIndex >=
        room.game.questions.length
    ) {
        finishCurrentRound(room);
        return;
    }

    const next =
        room.game.questions[
            room.game.questionIndex
        ];

    room.game.estimateQuestion =
        next.question;

    room.game.correctEstimate =
        next.answer;

    room.game.questionNumber =
        room.game.questionIndex + 1;

    room.game.submitted = {};
    room.game.answers = {};

    broadcastState(room);
}

/* =========================================================
   RUNDENENDE
   ========================================================= */

function finishCurrentRound(room) {
    if (!room) return;

    clearRoomTimers(room);

    room.phase = "results";

    const activePlayers =
        getActivePlayers(room);

    room.results = activePlayers
        .map(player => ({
            id: player.id,
            name: player.name,
            roundScore: player.score || 0,
            totalScore: player.score || 0
        }))
        .sort(
            (a, b) =>
                b.roundScore - a.roundScore
        );

    broadcastState(room);

    if (room.round >= room.totalRounds) {
        finishGame(room);
    }
}

function continueNextRound(room) {
    if (!room) return;

    if (room.round >= room.totalRounds) {
        finishGame(room);
        return;
    }

    room.round++;

    if (room.category === "nennen") {
        prepareNennenRound(room);
    } else if (room.category === "quiz") {
        prepareQuizRound(room);
    } else if (room.category === "estimate") {
        prepareEstimateRound(room);
    }
}

function finishGame(room) {
    clearRoomTimers(room);

    room.phase = "final";

    const activePlayers =
        getActivePlayers(room);

    const ranking = activePlayers
        .map(player => ({
            id: player.id,
            name: player.name,
            score: player.score || 0
        }))
        .sort(
            (a, b) =>
                b.score - a.score
        );

    room.winner = ranking[0] || null;

    broadcastState(room);
}

/* =========================================================
   HTTP SERVER
   ========================================================= */

const server = http.createServer(
    (request, response) => {
        try {
            let requestPath =
                decodeURIComponent(
                    request.url.split("?")[0]
                );

            if (requestPath === "/") {
                requestPath = "/index.html";
            }

            const filePath = path.join(
                __dirname,
                requestPath
            );

            /*
                Verhindert Zugriff außerhalb
                des Projektordners.
            */
            const normalizedPath =
                path.normalize(filePath);

            if (
                !normalizedPath.startsWith(
                    path.normalize(__dirname)
                )
            ) {
                response.writeHead(403);
                response.end("Forbidden");
                return;
            }

            fs.stat(
                normalizedPath,
                (error, stats) => {
                    if (error || !stats.isFile()) {
                        response.writeHead(404);
                        response.end("Not found");
                        return;
                    }

                    const ext =
                        path.extname(normalizedPath)
                            .toLowerCase();

                    const mimeTypes = {
                        ".html": "text/html; charset=utf-8",
                        ".js": "text/javascript; charset=utf-8",
                        ".css": "text/css; charset=utf-8",
                        ".json": "application/json; charset=utf-8",
                        ".png": "image/png",
                        ".jpg": "image/jpeg",
                        ".jpeg": "image/jpeg",
                        ".gif": "image/gif",
                        ".svg": "image/svg+xml",
                        ".ico": "image/x-icon",
                        ".webp": "image/webp"
                    };

                    response.writeHead(200, {
                        "Content-Type":
                            mimeTypes[ext] ||
                            "application/octet-stream"
                    });

                    fs.createReadStream(
                        normalizedPath
                    ).pipe(response);
                }
            );
        } catch (error) {
            console.error(
                "HTTP-Fehler:",
                error
            );

            response.writeHead(500);
            response.end("Internal Server Error");
        }
    }
);

/* =========================================================
   WEBSOCKET
   ========================================================= */

const wss = new WebSocket.Server({
    server
});

wss.on("connection", socket => {
    clients.add(socket);

    socket.on("message", raw => {
        let data;

        try {
            data = JSON.parse(
                raw.toString()
            );
        } catch {
            sendError(
                socket,
                "Ungültige Nachricht."
            );
            return;
        }

        handleMessage(socket, data);
    });

    socket.on("close", () => {
        clients.delete(socket);

        handleDisconnect(socket);
    });

    socket.on("error", error => {
        console.error(
            "WebSocket Fehler:",
            error
        );
    });
});

/* =========================================================
   MESSAGE HANDLER
   ========================================================= */

function handleMessage(socket, data) {
    const type = data?.type;

    switch (type) {
        case "identify":
            handleIdentify(socket, data);
            break;

        case "create_room":
            handleCreateRoom(socket, data);
            break;

        case "join_room":
            handleJoinRoom(socket, data);
            break;

        case "leave_room":
            handleLeaveRoom(socket);
            break;

        case "set_playing":
            handleSetPlaying(socket, data);
            break;

        case "start_game":
            handleStartGame(socket, data);
            break;

        case "start_category":
            handleStartCategory(socket, data);
            break;

        case "nennen_answer":
            handleNennenMessage(socket, data);
            break;

        case "quiz_answer":
            handleQuizMessage(socket, data);
            break;

        case "estimate_answer":
            handleEstimateMessage(socket, data);
            break;

        case "next_round":
            handleNextRound(socket);
            break;

        case "restart":
            handleRestart(socket);
            break;

        default:
            sendError(
                socket,
                "Unbekannter Nachrichtentyp."
            );
    }
}

/* =========================================================
   IDENTIFY
   ========================================================= */

function handleIdentify(socket, data) {
    let identityId =
        String(data.identityId || "")
            .trim();

    let playerId =
        String(data.playerId || "")
            .trim();

    if (!identityId) {
        identityId = randomId();
    }

    if (!playerId) {
        playerId = randomId();
    }

    let player =
        playersById.get(playerId);

    if (!player) {
        player = {
            id: playerId,

            identityId,

            name: safeName(data.name),

            owner: false,

            playing: true,

            roomCode: null,

            score: 0,

            connections: new Set()
        };

        playersById.set(
            playerId,
            player
        );
    }

    player.identityId = identityId;

    if (data.name) {
        player.name = safeName(data.name);
    }

    player.connections.add(socket);

    socket.playerId = player.id;

    playersByIdentity.set(
        identityId,
        player
    );

    send(socket, {
        type: "identified",

        playerId: player.id,

        identityId: player.identityId,

        name: player.name
    });

    const room = getRoomOfPlayer(player);

    if (room) {
        send(socket, buildRoomState(room));
    }
}

/* =========================================================
   ROOM CREATE
   ========================================================= */

function handleCreateRoom(socket, data) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        sendError(
            socket,
            "Bitte zuerst identifizieren."
        );
        return;
    }

    if (player.roomCode) {
        sendError(
            socket,
            "Du bist bereits in einem Raum."
        );
        return;
    }

    player.name = safeName(data.name);

    player.owner = true;
    player.playing =
        data.playing !== false;

    player.score = 0;

    const room =
        createRoom(player);

    send(socket, {
        type: "room_created",
        roomCode: room.code
    });

    broadcastState(room);
}

/* =========================================================
   JOIN ROOM
   ========================================================= */

function handleJoinRoom(socket, data) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        sendError(
            socket,
            "Bitte zuerst identifizieren."
        );
        return;
    }

    if (player.roomCode) {
        sendError(
            socket,
            "Du bist bereits in einem Raum."
        );
        return;
    }

    const code =
        String(data.roomCode || "")
            .trim()
            .toUpperCase();

    const room =
        rooms.get(code);

    if (!room) {
        sendError(
            socket,
            "Raum nicht gefunden."
        );
        return;
    }

    if (room.phase !== "lobby") {
        sendError(
            socket,
            "Das Spiel wurde bereits gestartet."
        );
        return;
    }

    if (room.players.length >= MAX_PLAYERS) {
        sendError(
            socket,
            "Der Raum ist voll."
        );
        return;
    }

    player.name =
        safeName(data.name);

    player.owner = false;
    player.playing = true;
    player.roomCode = room.code;
    player.score = 0;

    room.players.push(player);

    send(socket, {
        type: "room_joined",
        roomCode: room.code
    });

    broadcastState(room);
}

/* =========================================================
   LEAVE
   ========================================================= */

function handleLeaveRoom(socket) {
    const player =
        getPlayerBySocket(socket);

    if (!player) return;

    const room =
        getRoomOfPlayer(player);

    if (!room) return;

    if (player.owner) {
        closeRoom(room);
        return;
    }

    removePlayerFromRoom(
        player,
        room
    );

    broadcastState(room);
}

/* =========================================================
   PLAYING TOGGLE
   ========================================================= */

function handleSetPlaying(socket, data) {
    const player =
        getPlayerBySocket(socket);

    if (!player) return;

    if (!player.owner) {
        return;
    }

    const room =
        getRoomOfPlayer(player);

    if (!room) return;

    if (room.phase !== "lobby") {
        return;
    }

    player.playing =
        data.playing === true;

    broadcastState(room);
}

/* =========================================================
   START GAME
   ========================================================= */

function handleStartGame(socket, data) {
    const player =
        getPlayerBySocket(socket);

    if (!player) return;

    const room =
        getRoomOfPlayer(player);

    if (!room) {
        sendError(
            socket,
            "Du bist in keinem Raum."
        );
        return;
    }

    if (player.id !== room.ownerId) {
        sendError(
            socket,
            "Nur der Besitzer kann das Spiel starten."
        );
        return;
    }

    if (room.phase !== "lobby") {
        sendError(
            socket,
            "Das Spiel läuft bereits."
        );
        return;
    }

    const activePlayers =
        getActivePlayers(room);

    /*
        WICHTIG:
        IMMER mindestens 2 aktive Spieler.
    */
    if (activePlayers.length < 2) {
        sendError(
            socket,
            "Mindestens 2 aktive Spieler werden benötigt."
        );
        return;
    }

    const category =
        String(
            data.category ||
            ""
        ).toLowerCase();

    const result =
        startGame(
            room,
            category
        );

    if (!result.ok) {
        sendError(
            socket,
            result.error
        );
        return;
    }

    broadcastState(room);
}

/*
    Optionaler Alias für Frontends,
    die start_category verwenden.
*/
function handleStartCategory(
    socket,
    data
) {
    handleStartGame(socket, {
        type: "start_game",
        category: data.category
    });
}

/* =========================================================
   NENNEN MESSAGE
   ========================================================= */

function handleNennenMessage(
    socket,
    data
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) return;

    handleNennenAnswer(
        player,
        data.answer
    );
}

/* =========================================================
   QUIZ MESSAGE
   ========================================================= */

function handleQuizMessage(
    socket,
    data
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) return;

    handleQuizAnswer(
        player,
        data.answerIndex
    );
}

/* =========================================================
   ESTIMATE MESSAGE
   ========================================================= */

function handleEstimateMessage(
    socket,
    data
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) return;

    handleEstimateAnswer(
        player,
        data.answer
    );
}

/* =========================================================
   NEXT ROUND
   ========================================================= */

function handleNextRound(socket) {
    const player =
        getPlayerBySocket(socket);

    if (!player) return;

    const room =
        getRoomOfPlayer(player);

    if (!room) return;

    if (player.id !== room.ownerId) {
        sendError(
            socket,
            "Nur der Besitzer kann die nächste Runde starten."
        );
        return;
    }

    if (room.phase !== "results") {
        return;
    }

    const activePlayers =
        getActivePlayers(room);

    if (activePlayers.length < 2) {
        finishGame(room);
        return;
    }

    continueNextRound(room);
}

/* =========================================================
   RESTART
   ========================================================= */

function handleRestart(socket) {
    const player =
        getPlayerBySocket(socket);

    if (!player) return;

    const room =
        getRoomOfPlayer(player);

    if (!room) return;

    if (player.id !== room.ownerId) {
        sendError(
            socket,
            "Nur der Besitzer kann neu starten."
        );
        return;
    }

    clearRoomTimers(room);

    room.phase = "lobby";
    room.category = null;
    room.round = 0;
    room.game = null;
    room.results = [];
    room.winner = null;

    for (const p of room.players) {
        p.score = 0;
    }

    broadcastState(room);
}

/* =========================================================
   DISCONNECT
   ========================================================= */

function handleDisconnect(socket) {
    const player =
        getPlayerBySocket(socket);

    if (!player) return;

    player.connections.delete(socket);

    /*
        Spieler bleibt im Raum, wenn nur eine
        einzelne Verbindung getrennt wurde.
    */
    if (
        player.connections.size > 0
    ) {
        return;
    }

    const room =
        getRoomOfPlayer(player);

    if (!room) return;

    /*
        Besitzer verlässt -> kompletter Raum weg.
    */
    if (player.owner) {
        closeRoom(room);
        return;
    }

    /*
        Im laufenden Spiel entfernen wir den
        normalen Spieler.
    */
    if (room.phase !== "lobby") {
        removePlayerFromRoom(
            player,
            room
        );

        const activePlayers =
            getConnectedActivePlayers(room);

        if (
            activePlayers.length < 2
        ) {
            finishGame(room);
            return;
        }

        broadcastState(room);
        return;
    }

    broadcastState(room);
}

/* =========================================================
   SERVER START
   ========================================================= */

server.listen(
    PORT,
    HOST,
    () => {
        console.log(
            `Minecraft Last Man Standing läuft auf ${HOST}:${PORT}`
        );

        console.log(
            `Umgebungs-Port: ${
                process.env.PORT || "nicht gesetzt"
            }`
        );
    }
);

process.on(
    "SIGINT",
    () => {
        console.log(
            "Server wird beendet..."
        );

        for (const room of rooms.values()) {
            clearRoomTimers(room);
        }

        server.close(() => {
            process.exit(0);
        });
    }
);