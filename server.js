
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

/* =========================================================
   SERVER
========================================================= */

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 5500;

const MAX_PLAYERS = 16;
const TOTAL_ROUNDS = 3;
const NENNEN_TIME_MS = 30_000;

const rooms = new Map();
const clients = new Set();
const playersById = new Map();
const playersByIdentity = new Map();

/* =========================================================
   FRAGEN
========================================================= */

const quizQuestions = [
    {
        question: "Wie viele Herzen hat ein Minecraft-Spieler standardmäßig?",
        answers: ["5", "10", "20", "40"],
        correct: 1
    },
    {
        question: "Welcher Mob explodiert, wenn er dem Spieler zu nahe kommt?",
        answers: ["Zombie", "Skelett", "Creeper", "Spinne"],
        correct: 2
    },
    {
        question: "Wie viele Diamanten benötigt man für eine vollständige Diamantrüstung?",
        answers: ["18", "24", "27", "32"],
        correct: 1
    },
    {
        question: "Welche Dimension wird durch ein Netherportal erreicht?",
        answers: ["End", "Nether", "Aether", "Deep Dark"],
        correct: 1
    },
    {
        question: "Wie viele Bücherregale braucht man für die maximale Verzauberungsstufe?",
        answers: ["10", "12", "15", "18"],
        correct: 2
    },
    {
        question: "Was braucht man, um einen Beacon zu craften?",
        answers: ["Netherstern", "Enderperle", "Diamant", "Schleimball"],
        correct: 0
    },
    {
        question: "Welches Erz ist für Diamantrüstung notwendig?",
        answers: ["Eisen", "Gold", "Diamant", "Kupfer"],
        correct: 2
    },
    {
        question: "Wie viele Slots besitzt eine große Truhe?",
        answers: ["27", "36", "45", "54"],
        correct: 3
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
        question: "Was droppt ein Creeper normalerweise?",
        answers: [
            "Knochen",
            "Schießpulver",
            "Fäden",
            "Pfeile"
        ],
        correct: 1
    },
    {
        question: "Welches Tool verwendet man normalerweise, um Stein abzubauen?",
        answers: [
            "Axt",
            "Schaufel",
            "Spitzhacke",
            "Hacke"
        ],
        correct: 2
    },
    {
        question: "Wie weit kann sich Wasser von einer Quelle horizontal ausbreiten?",
        answers: ["4", "5", "7", "9"],
        correct: 2
    }
];

const estimateQuestions = [
    {
        question: "Wie viele Herzen hat ein Creeper?",
        answer: 10
    },
    {
        question: "Wie viele Slots hat eine große Truhe?",
        answer: 54
    },
    {
        question: "Wie viele Bücherregale werden für Level-30-Verzauberungen benötigt?",
        answer: 15
    },
    {
        question: "Wie weit kann Wasser von einer Quelle fließen?",
        answer: 7
    },
    {
        question: "Wie viele Enderaugen werden maximal für ein Endportal benötigt?",
        answer: 12
    },
    {
        question: "Wie viele Slots hat die Hotbar?",
        answer: 9
    },
    {
        question: "Wie viele Herzen hat ein Zombie?",
        answer: 10
    },
    {
        question: "Wie hoch ist ein Minecraft-Spieler ungefähr?",
        answer: 2
    },
    {
        question: "Wie viele Items passen normalerweise in einen Stack?",
        answer: 64
    },
    {
        question: "Wie viele Minuten dauert ein kompletter Minecraft-Tag?",
        answer: 20
    }
];

const nennenPrompts = [
    "Nenne etwas aus Minecraft.",
    "Nenne einen Minecraft-Mob.",
    "Nenne einen Minecraft-Block.",
    "Nenne ein Minecraft-Item.",
    "Nenne ein Werkzeug aus Minecraft.",
    "Nenne eine Minecraft-Waffe.",
    "Nenne ein Minecraft-Erz.",
    "Nenne etwas, das man craften kann.",
    "Nenne etwas aus dem Nether.",
    "Nenne etwas aus dem End."
];

const nennenCategories = {
    mob: [
        "zombie",
        "skelett",
        "creeper",
        "spinne",
        "enderman",
        "kuh",
        "schwein",
        "schaf",
        "huhn",
        "dorfbewohner",
        "dörfler",
        "hexe",
        "eisengolem",
        "schneegolem",
        "enderdrache",
        "wither",
        "slime",
        "magma cube",
        "phantom",
        "ghast",
        "blaze",
        "piglin",
        "zombifizierter piglin",
        "zombie piglin",
        "hoglin",
        "shulker",
        "silverfish",
        "fledermaus",
        "fuchs",
        "wolf",
        "katze",
        "pferd",
        "esel",
        "maultier",
        "papagei",
        "tintenfisch",
        "delfin",
        "axolotl",
        "ziege",
        "frosch",
        "kaulquappe"
    ],

    block: [
        "grasblock",
        "gras",
        "erde",
        "stein",
        "andesit",
        "diorit",
        "granit",
        "obsidian",
        "sand",
        "roter sand",
        "kies",
        "glas",
        "holz",
        "eichenholz",
        "fichtenholz",
        "birkenholz",
        "dschungelholz",
        "akazienholz",
        "mangrovenholz",
        "kirschholz",
        "wolle",
        "tnt",
        "fackel",
        "leuchtfeuer",
        "ziegel",
        "terracotta",
        "schwarzstein",
        "netherrack",
        "endstein"
    ],

    item: [
        "diamant",
        "eisenbarren",
        "goldbarren",
        "netheritbarren",
        "stock",
        "apfel",
        "brot",
        "karotte",
        "kartoffel",
        "weizen",
        "enderperle",
        "enderauge",
        "feuerzeug",
        "eimer",
        "sattel",
        "angel",
        "buch",
        "leder",
        "faden",
        "schießpulver",
        "knochen",
        "pfeil",
        "samen",
        "smaragd",
        "redstone",
        "lapislazuli",
        "amethystsplitter"
    ],

    tool: [
        "spitzhacke",
        "axt",
        "schaufel",
        "hacke",
        "angel",
        "feuerzeug",
        "schere"
    ],

    weapon: [
        "schwert",
        "bogen",
        "armbrust",
        "dreizack"
    ],

    ore: [
        "kohleerz",
        "eisenerz",
        "golderz",
        "kupfererz",
        "redstoneerz",
        "lapislazulierz",
        "diamantenerz",
        "smaragderz",
        "nethergolderz",
        "antiker schrott"
    ],

    nether: [
        "netherrack",
        "seelensand",
        "seelenerde",
        "basalt",
        "schwarzstein",
        "netherziegel",
        "quarz",
        "netherquarzerz",
        "blaze",
        "ghast",
        "piglin",
        "hoglin",
        "bastion",
        "netherfestung",
        "lava"
    ],

    end: [
        "enderdrache",
        "enderman",
        "endstein",
        "obsidian",
        "choruspflanze",
        "chorusfrucht",
        "shulker",
        "endstadt",
        "enderperle",
        "enderauge"
    ],

    craft: [
        "fackel",
        "werkbank",
        "ofen",
        "truhe",
        "schwert",
        "spitzhacke",
        "axt",
        "schaufel",
        "hacke",
        "bogen",
        "eimer",
        "schild",
        "bett",
        "amboss",
        "verzauberungstisch",
        "braustand",
        "schmelzofen",
        "räucherofen"
    ]
};

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
            code += chars[
                Math.floor(
                    Math.random() * chars.length
                )
            ];
        }
    } while (rooms.has(code));

    return code;
}

function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(
            Math.random() * (i + 1)
        );

        [copy[i], copy[j]] = [
            copy[j],
            copy[i]
        ];
    }

    return copy;
}

function normalize(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function safeName(name) {
    const cleaned = String(name ?? "")
        .trim()
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 20);

    return cleaned || "Spieler";
}

function isPlayerActive(player) {
    if (!player) {
        return false;
    }

    if (!player.owner) {
        return true;
    }

    return player.playing === true;
}

function isConnected(player) {
    return Boolean(
        player &&
        player.connections &&
        player.connections.size > 0
    );
}

function getActivePlayers(room) {
    return room.players.filter(
        player =>
            isPlayerActive(player) &&
            isConnected(player)
    );
}

function getAllActivePlayers(room) {
    return room.players.filter(
        player => isPlayerActive(player)
    );
}

function getPlayerBySocket(socket) {
    if (!socket?.playerId) {
        return null;
    }

    return (
        playersById.get(
            socket.playerId
        ) || null
    );
}

function getRoom(player) {
    if (!player?.roomCode) {
        return null;
    }

    return (
        rooms.get(
            player.roomCode
        ) || null
    );
}

function send(socket, payload) {
    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    try {
        socket.send(
            JSON.stringify(payload)
        );
    } catch (error) {
        console.error(
            "WebSocket-Sendefehler:",
            error.message
        );
    }
}

function sendError(socket, message) {
    send(socket, {
        type: "error",
        message: String(message)
    });
}

function broadcast(room, payload) {
    if (!room) {
        return;
    }

    for (const player of room.players) {
        for (const socket of player.connections) {
            send(socket, payload);
        }
    }
}

/* =========================================================
   ONLINE-ZÄHLER
========================================================= */

function getOnlineCount() {
    let count = 0;

    for (const socket of clients) {
        if (
            socket.readyState ===
            WebSocket.OPEN
        ) {
            count++;
        }
    }

    return count;
}

function broadcastOnlineCount() {
    const count =
        getOnlineCount();

    for (const socket of clients) {
        if (
            socket.readyState ===
            WebSocket.OPEN
        ) {
            send(socket, {
                type: "onlineCount",
                count
            });
        }
    }
}

/* =========================================================
   TIMER
========================================================= */

function clearTimers(room) {
    if (!room) {
        return;
    }

    if (room.nennenTimer) {
        clearTimeout(
            room.nennenTimer
        );

        room.nennenTimer = null;
    }
}

/* =========================================================
   PLAYER STATE
========================================================= */

function serializePlayer(player) {
    return {
        id: player.id,
        name: player.name,
        owner: player.owner === true,
        playing: player.owner
            ? player.playing === true
            : true,
        connected: isConnected(player),
        score: Number(
            player.score || 0
        )
    };
}

/* =========================================================
   GAME STATE
========================================================= */

function buildNennenState(room, viewer) {
    const game = room.game;

    if (!game) {
        return null;
    }

    return {
        round: room.round,
        totalRounds: TOTAL_ROUNDS,

        title: "Nennen",

        description:
            game.prompt ||
            "Nenne einen passenden Begriff.",

        currentPlayerId:
            game.currentPlayerId,

        turnEndsAt:
            game.turnEndsAt,

        usedAnswers:
            [...game.usedAnswers],

        isOwner:
            viewer?.id === room.ownerId
    };
}

function buildQuizState(room, viewer) {
    const game = room.game;

    if (!game) {
        return null;
    }

    const answered =
        Boolean(
            game.answered[
                viewer?.id
            ]
        );

    const isOwner =
        viewer?.id === room.ownerId;

    return {
        round: room.round,
        totalRounds: TOTAL_ROUNDS,

        number:
            game.questionIndex + 1,

        totalQuestions:
            game.questions.length,

        question:
            game.current.question,

        answers:
            game.current.answers,

        currentPlayerId:
            game.currentPlayerId,

        answered,

        correct:
            isOwner &&
            room.ownerPlaying === false
                ? game.current.correct
                : undefined
    };
}

function buildEstimateState(
    room,
    viewer
) {
    const game = room.game;

    if (!game) {
        return null;
    }

    const answered =
        Boolean(
            game.answered[
                viewer?.id
            ]
        );

    const isOwner =
        viewer?.id === room.ownerId;

    return {
        round: room.round,
        totalRounds: TOTAL_ROUNDS,

        number:
            game.questionIndex + 1,

        totalQuestions:
            game.questions.length,

        question:
            game.current.question,

        currentPlayerId:
            game.currentPlayerId,

        answered,

        answer:
            isOwner &&
            room.ownerPlaying === false
                ? game.current.answer
                : undefined
    };
}

function buildResultsState(room) {
    const players =
        getAllActivePlayers(room)
            .map(player => ({
                id: player.id,
                name: player.name,

                points:
                    Number(
                        player.lastRoundPoints ||
                        0
                    ),

                score:
                    Number(
                        player.score || 0
                    ),

                total:
                    Number(
                        player.score || 0
                    )
            }))
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            );

    return {
        message:
            room.resultsMessage ||
            (
                room.round >=
                TOTAL_ROUNDS
                    ? "Alle Runden wurden gespielt."
                    : `Runde ${room.round} beendet.`
            ),

        players
    };
}

function buildFinalState(room) {
    const players =
        getAllActivePlayers(room)
            .map(player => ({
                id: player.id,
                name: player.name,
                score:
                    Number(
                        player.score || 0
                    ),
                total:
                    Number(
                        player.score || 0
                    )
            }))
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            );

    return {
        winner:
            players[0] || null,

        players
    };
}

function buildState(
    room,
    viewer
) {
    const isOwner =
        viewer?.id === room.ownerId;

    return {
        code:
            room.code,

        phase:
            room.phase,

        category:
            room.category,

        round:
            room.round,

        totalRounds:
            TOTAL_ROUNDS,

        myPlayerId:
            viewer?.id || null,

        isOwner,

        ownerPlaying:
            room.ownerPlaying === true,

        players:
            room.players.map(
                serializePlayer
            ),

        nennen:
            room.phase === "nennen"
                ? buildNennenState(
                      room,
                      viewer
                  )
                : null,

        quiz:
            room.phase === "quiz"
                ? buildQuizState(
                      room,
                      viewer
                  )
                : null,

        estimate:
            room.phase === "estimate"
                ? buildEstimateState(
                      room,
                      viewer
                  )
                : null,

        results:
            room.phase === "results"
                ? buildResultsState(
                      room
                  )
                : null,

        final:
            room.phase === "final"
                ? buildFinalState(
                      room
                  )
                : null
    };
}

function sendStateToRoom(room) {
    if (!room) {
        return;
    }

    for (const player of room.players) {
        for (const socket of player.connections) {
            send(socket, {
                type: "state",
                state:
                    buildState(
                        room,
                        player
                    )
            });
        }
    }
}

/* =========================================================
   ROOM
========================================================= */

function createRoom(player) {
    const code =
        randomRoomCode();

    const room = {
        code,

        ownerId:
            player.id,

        ownerPlaying:
            true,

        players: [],

        phase:
            "lobby",

        category:
            null,

        round:
            0,

        game:
            null,

        nennenTimer:
            null,

        resultsMessage:
            "",

        finalMessage:
            ""
    };

    player.roomCode =
        room.code;

    player.owner =
        true;

    player.playing =
        true;

    player.score =
        0;

    player.lastRoundPoints =
        0;

    room.players.push(
        player
    );

    rooms.set(
        room.code,
        room
    );

    return room;
}

function closeRoom(
    room,
    reason =
        "Der Raum wurde geschlossen."
) {
    if (!room) {
        return;
    }

    clearTimers(room);

    for (const player of room.players) {
        player.roomCode =
            null;

        player.owner =
            false;

        player.playing =
            true;

        for (const socket of player.connections) {
            send(socket, {
                type: "leftRoom"
            });

            send(socket, {
                type: "error",
                message: reason
            });
        }
    }

    rooms.delete(
        room.code
    );
}

/* =========================================================
   NEUE RUNDE
========================================================= */

function resetRoundScores(room) {
    for (const player of room.players) {
        player.lastRoundPoints = 0;
    }
}

function startCategory(
    room,
    category
) {
    if (!room) {
        return;
    }

    clearTimers(room);
    resetRoundScores(room);

    room.category =
        category;

    if (category === "nennen") {
        room.phase =
            "nennen";

        startNennenRound(room);

        return;
    }

    if (category === "quiz") {
        room.phase =
            "quiz";

        startQuizRound(room);

        return;
    }

    if (category === "estimate") {
        room.phase =
            "estimate";

        startEstimateRound(room);
    }
}

/* =========================================================
   NENNEN
========================================================= */

function pickNennenPrompt() {
    return nennenPrompts[
        Math.floor(
            Math.random() *
            nennenPrompts.length
        )
    ];
}

function validateNennenAnswer(
    answer
) {
    const normalized =
        normalize(answer);

    if (!normalized) {
        return {
            valid: false,
            reason:
                "Bitte gib eine Antwort ein."
        };
    }

    const words =
        Object.values(
            nennenCategories
        ).flat();

    if (
        words.includes(
            normalized
        )
    ) {
        return {
            valid: true
        };
    }

    const flexibleWords = [
        "minecraft",
        "creeper",
        "zombie",
        "skelett",
        "spinne",
        "enderman",
        "diamant",
        "eisen",
        "gold",
        "stein",
        "erde",
        "holz",
        "schwert",
        "bogen",
        "armbrust",
        "spitzhacke",
        "axt",
        "schaufel",
        "hacke",
        "obsidian",
        "nether",
        "enderdrache",
        "enderperle",
        "redstone",
        "smaragd",
        "lapislazuli",
        "tnt",
        "fackel",
        "truhe",
        "werkbank",
        "ofen",
        "dorf",
        "wüste",
        "dschungel",
        "lava",
        "wasser"
    ];

    if (
        flexibleWords.includes(
            normalized
        )
    ) {
        return {
            valid: true
        };
    }

    return {
        valid: false,
        reason:
            `„${answer}“ ist keine gültige Minecraft-Antwort.`
    };
}

function startNennenRound(room) {
    const players =
        getActivePlayers(room);

    if (players.length < 2) {
        finishGame(
            room,
            "Mindestens 2 aktive Spieler werden benötigt."
        );

        return;
    }

    const order =
        shuffle(players);

    room.game = {
        prompt:
            pickNennenPrompt(),

        currentPlayerId:
            order[0].id,

        turnIndex:
            0,

        order:
            order.map(
                player =>
                    player.id
            ),

        turnEndsAt:
            Date.now() +
            NENNEN_TIME_MS,

        usedAnswers:
            new Set()
    };

    startNennenTimer(room);

    sendStateToRoom(room);
}

function startNennenTimer(room) {
    clearTimers(room);

    if (!room.game) {
        return;
    }

    const remaining =
        Math.max(
            0,
            room.game.turnEndsAt -
                Date.now()
        );

    room.nennenTimer =
        setTimeout(
            () => {
                if (
                    room.phase !==
                    "nennen"
                ) {
                    return;
                }

                const current =
                    room.players.find(
                        player =>
                            player.id ===
                            room.game.currentPlayerId
                    );

                if (current) {
                    current.lastRoundPoints =
                        0;
                }

                finishNennenRound(
                    room,
                    `${current?.name || "Spieler"} hat die Zeit überschritten.`
                );
            },
            remaining
        );
}

function nextNennenTurn(room) {
    const active =
        getActivePlayers(room);

    if (active.length < 2) {
        finishGame(
            room,
            "Es sind nicht mehr genügend aktive Spieler übrig."
        );

        return;
    }

    const validOrder =
        room.game.order.filter(
            id =>
                active.some(
                    player =>
                        player.id === id
                )
        );

    if (!validOrder.length) {
        finishNennenRound(room);
        return;
    }

    room.game.order =
        validOrder;

    room.game.turnIndex =
        (
            room.game.turnIndex +
            1
        ) %
        room.game.order.length;

    room.game.currentPlayerId =
        room.game.order[
            room.game.turnIndex
        ];

    room.game.turnEndsAt =
        Date.now() +
        NENNEN_TIME_MS;

    startNennenTimer(room);

    sendStateToRoom(room);
}

function handleNennenAnswer(
    socket,
    data
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        return;
    }

    const room =
        getRoom(player);

    if (
        !room ||
        room.phase !==
            "nennen" ||
        !room.game
    ) {
        return;
    }

    if (
        room.game.currentPlayerId !==
        player.id
    ) {
        return;
    }

    const rawAnswer =
        String(
            data?.answer ?? ""
        ).trim();

    if (!rawAnswer) {
        return;
    }

    const normalized =
        normalize(rawAnswer);

    if (
        room.game.usedAnswers.has(
            normalized
        )
    ) {
        player.lastRoundPoints = 0;

        finishNennenRound(
            room,
            `${player.name} hat einen Begriff wiederholt.`
        );

        return;
    }

    const result =
        validateNennenAnswer(
            rawAnswer
        );

    if (!result.valid) {
        player.lastRoundPoints = 0;

        finishNennenRound(
            room,
            result.reason
        );

        return;
    }

    room.game.usedAnswers.add(
        normalized
    );

    player.lastRoundPoints =
        1;

    player.score += 1;

    nextNennenTurn(room);
}

function finishNennenRound(
    room,
    message =
        "Runde beendet."
) {
    clearTimers(room);

    room.resultsMessage =
        message;

    finishRound(
        room,
        message
    );
}

/* =========================================================
   QUIZ
========================================================= */

function startQuizRound(room) {
    const players =
        getActivePlayers(room);

    if (players.length < 2) {
        finishGame(
            room,
            "Mindestens 2 aktive Spieler werden benötigt."
        );

        return;
    }

    const questions =
        shuffle(
            quizQuestions
        ).slice(0, 5);

    const order =
        shuffle(
            players
        );

    room.game = {
        questions,

        questionIndex:
            0,

        current:
            questions[0],

        currentPlayerId:
            order[0].id,

        order:
            order.map(
                player =>
                    player.id
            ),

        turnIndex:
            0,

        answered: {}
    };

    sendStateToRoom(room);
}

function handleQuizAnswer(
    socket,
    data
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        return;
    }

    const room =
        getRoom(player);

    if (
        !room ||
        room.phase !==
            "quiz" ||
        !room.game
    ) {
        return;
    }

    if (
        room.game.currentPlayerId !==
        player.id
    ) {
        return;
    }

    if (
        room.game.answered[
            player.id
        ]
    ) {
        return;
    }

    const answer =
        Number(
            data?.answer
        );

    if (
        !Number.isInteger(
            answer
        )
    ) {
        return;
    }

    room.game.answered[
        player.id
    ] = true;

    if (
        answer ===
        room.game.current.correct
    ) {
        player.lastRoundPoints =
            1;

        player.score += 1;
    } else {
        player.lastRoundPoints =
            0;
    }

    sendStateToRoom(room);

    setTimeout(() => {
        if (
            !rooms.has(
                room.code
            ) ||
            room.phase !==
                "quiz"
        ) {
            return;
        }

        nextQuizTurn(room);
    }, 900);
}

function nextQuizTurn(room) {
    const active =
        getActivePlayers(room);

    if (active.length < 2) {
        finishGame(
            room,
            "Es sind nicht mehr genügend aktive Spieler übrig."
        );

        return;
    }

    room.game.questionIndex++;

    if (
        room.game.questionIndex >=
        room.game.questions.length
    ) {
        finishRound(
            room,
            "Quiz-Runde beendet."
        );

        return;
    }

    room.game.order =
        room.game.order.filter(
            id =>
                active.some(
                    player =>
                        player.id === id
                )
        );

    if (
        !room.game.order.length
    ) {
        room.game.order =
            shuffle(active).map(
                player =>
                    player.id
            );

        room.game.turnIndex =
            0;
    } else {
        room.game.turnIndex =
            (
                room.game.turnIndex +
                1
            ) %
            room.game.order.length;
    }

    room.game.currentPlayerId =
        room.game.order[
            room.game.turnIndex
        ];

    room.game.current =
        room.game.questions[
            room.game.questionIndex
        ];

    room.game.answered = {};

    sendStateToRoom(room);
}

/* =========================================================
   ESTIMATE
========================================================= */

function startEstimateRound(room) {
    const players =
        getActivePlayers(room);

    if (players.length < 2) {
        finishGame(
            room,
            "Mindestens 2 aktive Spieler werden benötigt."
        );

        return;
    }

    const questions =
        shuffle(
            estimateQuestions
        ).slice(0, 5);

    const order =
        shuffle(
            players
        );

    room.game = {
        questions,

        questionIndex:
            0,

        current:
            questions[0],

        currentPlayerId:
            order[0].id,

        order:
            order.map(
                player =>
                    player.id
            ),

        turnIndex:
            0,

        answered: {}
    };

    sendStateToRoom(room);
}

function calculateEstimatePoints(
    guess,
    correct
) {
    if (guess === correct) {
        return 3;
    }

    if (
        correct === 0
    ) {
        return 0;
    }

    const percentage =
        Math.abs(
            guess - correct
        ) /
        Math.abs(correct) *
        100;

    if (percentage <= 5) {
        return 2;
    }

    if (percentage <= 15) {
        return 1;
    }

    return 0;
}

function handleEstimateAnswer(
    socket,
    data
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        return;
    }

    const room =
        getRoom(player);

    if (
        !room ||
        room.phase !==
            "estimate" ||
        !room.game
    ) {
        return;
    }

    if (
        room.game.currentPlayerId !==
        player.id
    ) {
        return;
    }

    if (
        room.game.answered[
            player.id
        ]
    ) {
        return;
    }

    const guess =
        Number(
            data?.answer
        );

    if (
        !Number.isFinite(
            guess
        )
    ) {
        return;
    }

    room.game.answered[
        player.id
    ] = true;

    const points =
        calculateEstimatePoints(
            guess,
            Number(
                room.game.current.answer
            )
        );

    player.lastRoundPoints =
        points;

    player.score += points;

    sendStateToRoom(room);

    setTimeout(() => {
        if (
            !rooms.has(
                room.code
            ) ||
            room.phase !==
                "estimate"
        ) {
            return;
        }

        nextEstimateTurn(room);
    }, 900);
}

function nextEstimateTurn(room) {
    const active =
        getActivePlayers(room);

    if (active.length < 2) {
        finishGame(
            room,
            "Es sind nicht mehr genügend aktive Spieler übrig."
        );

        return;
    }

    room.game.questionIndex++;

    if (
        room.game.questionIndex >=
        room.game.questions.length
    ) {
        finishRound(
            room,
            "Schätzfragen-Runde beendet."
        );

        return;
    }

    room.game.order =
        room.game.order.filter(
            id =>
                active.some(
                    player =>
                        player.id === id
                )
        );

    if (
        !room.game.order.length
    ) {
        room.game.order =
            shuffle(active).map(
                player =>
                    player.id
            );

        room.game.turnIndex =
            0;
    } else {
        room.game.turnIndex =
            (
                room.game.turnIndex +
                1
            ) %
            room.game.order.length;
    }

    room.game.currentPlayerId =
        room.game.order[
            room.game.turnIndex
        ];

    room.game.current =
        room.game.questions[
            room.game.questionIndex
        ];

    room.game.answered = {};

    sendStateToRoom(room);
}

/* =========================================================
   RUNDENENDE
========================================================= */

function finishRound(
    room,
    message =
        "Runde beendet."
) {
    clearTimers(room);

    room.resultsMessage =
        message;

    room.phase =
        "results";

    room.game =
        null;

    sendStateToRoom(room);
}

function startNextRound(room) {
    const active =
        getActivePlayers(room);

    if (active.length < 2) {
        finishGame(
            room,
            "Mindestens 2 aktive Spieler werden benötigt."
        );

        return;
    }

    if (
        room.round >=
        TOTAL_ROUNDS
    ) {
        finishGame(room);
        return;
    }

    room.round++;

    startCategory(
        room,
        room.category
    );
}

function finishGame(
    room,
    message =
        "Spiel beendet."
) {
    clearTimers(room);

    room.phase =
        "final";

    room.game =
        null;

    room.finalMessage =
        message;

    sendStateToRoom(room);
}

function restartRoom(room) {
    clearTimers(room);

    room.phase =
        "lobby";

    room.category =
        null;

    room.round =
        0;

    room.game =
        null;

    room.resultsMessage =
        "";

    room.finalMessage =
        "";

    for (const player of room.players) {
        player.score =
            0;

        player.lastRoundPoints =
            0;
    }

    sendStateToRoom(room);
}

/* =========================================================
   PLAYER ERSTELLEN
========================================================= */

function createPlayer(
    identityId
) {
    const identity =
        String(
            identityId || ""
        ).trim() ||
        randomId();

    const existing =
        playersByIdentity.get(
            identity
        );

    if (existing) {
        return existing;
    }

    const player = {
        id:
            randomId(),

        identityId:
            identity,

        name:
            "Spieler",

        owner:
            false,

        playing:
            true,

        roomCode:
            null,

        score:
            0,

        lastRoundPoints:
            0,

        connections:
            new Set()
    };

    playersById.set(
        player.id,
        player
    );

    playersByIdentity.set(
        player.identityId,
        player
    );

    return player;
}

function attachSocketToPlayer(
    player,
    socket
) {
    if (!player) {
        return;
    }

    player.connections.add(
        socket
    );

    socket.playerId =
        player.id;
}

/* =========================================================
   IDENTIFY
========================================================= */

function handleIdentify(
    socket,
    data
) {
    const identityId =
        String(
            data?.identityId || ""
        ).trim();

    let player =
        identityId
            ? playersByIdentity.get(
                  identityId
              )
            : null;

    if (!player) {
        player =
            createPlayer(
                identityId
            );
    }

    attachSocketToPlayer(
        player,
        socket
    );

    send(socket, {
        type: "identified",

        playerId:
            player.id,

        identityId:
            player.identityId,

        name:
            player.name
    });

    /*
        Dem gerade verbundenen Client
        sofort den aktuellen Online-Stand senden.
    */
    broadcastOnlineCount();

    const room =
        getRoom(player);

    if (room) {
        send(socket, {
            type: "state",
            state:
                buildState(
                    room,
                    player
                )
        });
    }
}

/* =========================================================
   CREATE ROOM
========================================================= */

function handleCreateRoom(
    socket,
    data
) {
    let player =
        getPlayerBySocket(socket);

    if (!player) {
        player =
            createPlayer(
                data?.identityId
            );

        attachSocketToPlayer(
            player,
            socket
        );
    }

    if (player.roomCode) {
        sendError(
            socket,
            "Du bist bereits in einem Raum."
        );

        return;
    }

    player.name =
        safeName(
            data?.name
        );

    player.owner =
        true;

    player.playing =
        true;

    const room =
        createRoom(player);

    socket.playerId =
        player.id;

    send(socket, {
        type: "roomCreated",
        code: room.code
    });

    sendStateToRoom(room);
}

/* =========================================================
   JOIN ROOM
========================================================= */

function handleJoinRoom(
    socket,
    data
) {
    let player =
        getPlayerBySocket(socket);

    if (!player) {
        player =
            createPlayer(
                data?.identityId
            );

        attachSocketToPlayer(
            player,
            socket
        );
    }

    if (player.roomCode) {
        sendError(
            socket,
            "Du bist bereits in einem Raum."
        );

        return;
    }

    const code =
        String(
            data?.code ?? ""
        )
            .trim()
            .toUpperCase();

    if (!code) {
        sendError(
            socket,
            "Bitte gib einen Raumcode ein."
        );

        return;
    }

    const room =
        rooms.get(code);

    if (!room) {
        sendError(
            socket,
            "Dieser Raum wurde nicht gefunden."
        );

        return;
    }

    if (
        room.phase !==
        "lobby"
    ) {
        sendError(
            socket,
            "Das Spiel läuft bereits."
        );

        return;
    }

    if (
        room.players.length >=
        MAX_PLAYERS
    ) {
        sendError(
            socket,
            "Der Raum ist voll."
        );

        return;
    }

    player.name =
        safeName(
            data?.name
        );

    player.owner =
        false;

    player.playing =
        true;

    player.score =
        0;

    player.lastRoundPoints =
        0;

    player.roomCode =
        room.code;

    room.players.push(
        player
    );

    socket.playerId =
        player.id;

    send(socket, {
        type: "joinedRoom",
        code:
            room.code
    });

    sendStateToRoom(room);
}

/* =========================================================
   LEAVE ROOM
========================================================= */

function handleLeaveRoom(
    socket
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        return;
    }

    const room =
        getRoom(player);

    if (!room) {
        send(socket, {
            type: "leftRoom"
        });

        return;
    }

    if (
        player.id ===
        room.ownerId
    ) {
        closeRoom(
            room,
            "Der Besitzer hat den Raum geschlossen."
        );

        return;
    }

    removePlayer(
        player,
        room
    );

    send(socket, {
        type: "leftRoom"
    });

    checkRunningGame(
        room
    );
}

/* =========================================================
   REMOVE PLAYER
========================================================= */

function removePlayer(
    player,
    room
) {
    const index =
        room.players.findIndex(
            item =>
                item.id ===
                player.id
        );

    if (index !== -1) {
        room.players.splice(
            index,
            1
        );
    }

    player.roomCode =
        null;

    player.owner =
        false;

    player.playing =
        true;

    player.score =
        0;

    player.lastRoundPoints =
        0;
}

function checkRunningGame(
    room
) {
    if (!room) {
        return;
    }

    if (
        room.phase ===
            "lobby" ||
        room.phase ===
            "category" ||
        room.phase ===
            "results" ||
        room.phase ===
            "final"
    ) {
        sendStateToRoom(room);
        return;
    }

    const active =
        getActivePlayers(room);

    if (active.length < 2) {
        finishGame(
            room,
            "Es sind nicht mehr genügend aktive Spieler übrig."
        );

        return;
    }

    if (
        room.game &&
        room.game.currentPlayerId
    ) {
        const current =
            room.players.find(
                player =>
                    player.id ===
                    room.game.currentPlayerId
            );

        if (!current) {
            if (
                room.phase ===
                "nennen"
            ) {
                nextNennenTurn(room);
            } else if (
                room.phase ===
                "quiz"
            ) {
                nextQuizTurn(room);
            } else if (
                room.phase ===
                "estimate"
            ) {
                nextEstimateTurn(room);
            }

            return;
        }
    }

    sendStateToRoom(room);
}

/* =========================================================
   OWNER PARTICIPATION
========================================================= */

function handleSetOwnerParticipation(
    socket,
    data
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        return;
    }

    const room =
        getRoom(player);

    if (
        !room ||
        player.id !==
            room.ownerId
    ) {
        return;
    }

    if (
        room.phase !==
        "lobby"
    ) {
        return;
    }

    const playing =
        data?.playing === true;

    player.playing =
        playing;

    room.ownerPlaying =
        playing;

    sendStateToRoom(room);
}

/* =========================================================
   START GAME
========================================================= */

function handleStartGame(
    socket
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        return;
    }

    const room =
        getRoom(player);

    if (!room) {
        sendError(
            socket,
            "Du bist in keinem Raum."
        );

        return;
    }

    if (
        player.id !==
        room.ownerId
    ) {
        sendError(
            socket,
            "Nur der Besitzer kann das Spiel starten."
        );

        return;
    }

    if (
        room.phase !==
        "lobby"
    ) {
        return;
    }

    const active =
        getActivePlayers(room);

    /*
        IMMER mindestens 2 aktive Spieler.
    */
    if (active.length < 2) {
        sendError(
            socket,
            "Mindestens 2 aktive Spieler werden benötigt."
        );

        return;
    }

    room.round =
        1;

    room.category =
        null;

    room.phase =
        "category";

    for (const p of room.players) {
        p.lastRoundPoints =
            0;

        p.score =
            0;
    }

    sendStateToRoom(room);
}

/* =========================================================
   CATEGORY
========================================================= */

function handleChooseCategory(
    socket,
    data
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        return;
    }

    const room =
        getRoom(player);

    if (!room) {
        return;
    }

    if (
        player.id !==
        room.ownerId
    ) {
        sendError(
            socket,
            "Nur der Besitzer kann die Kategorie auswählen."
        );

        return;
    }

    if (
        room.phase !==
        "category"
    ) {
        return;
    }

    const category =
        String(
            data?.category || ""
        ).toLowerCase();

    if (
        ![
            "nennen",
            "quiz",
            "estimate"
        ].includes(
            category
        )
    ) {
        sendError(
            socket,
            "Ungültige Kategorie."
        );

        return;
    }

    const active =
        getActivePlayers(room);

    if (active.length < 2) {
        sendError(
            socket,
            "Mindestens 2 aktive Spieler werden benötigt."
        );

        return;
    }

    startCategory(
        room,
        category
    );
}

/* =========================================================
   CONTINUE ROUND
========================================================= */

function handleContinueRound(
    socket
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        return;
    }

    const room =
        getRoom(player);

    if (!room) {
        return;
    }

    if (
        player.id !==
        room.ownerId
    ) {
        sendError(
            socket,
            "Nur der Besitzer kann fortfahren."
        );

        return;
    }

    if (
        room.phase !==
        "results"
    ) {
        return;
    }

    if (
        room.round >=
        TOTAL_ROUNDS
    ) {
        finishGame(room);
        return;
    }

    startNextRound(room);
}

/* =========================================================
   RESTART
========================================================= */

function handleRestart(
    socket
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        return;
    }

    const room =
        getRoom(player);

    if (!room) {
        return;
    }

    if (
        player.id !==
        room.ownerId
    ) {
        return;
    }

    restartRoom(room);
}

/* =========================================================
   MESSAGE HANDLER
========================================================= */

function handleMessage(
    socket,
    data
) {
    if (
        !data ||
        typeof data !==
            "object"
    ) {
        sendError(
            socket,
            "Ungültige Nachricht."
        );

        return;
    }

    switch (
        String(
            data.type || ""
        )
    ) {
        case "identify":
            handleIdentify(
                socket,
                data
            );
            break;

        case "createRoom":
            handleCreateRoom(
                socket,
                data
            );
            break;

        case "joinRoom":
            handleJoinRoom(
                socket,
                data
            );
            break;

        case "leaveRoom":
            handleLeaveRoom(
                socket
            );
            break;

        case "setOwnerParticipation":
            handleSetOwnerParticipation(
                socket,
                data
            );
            break;

        case "startGame":
            handleStartGame(
                socket
            );
            break;

        case "chooseCategory":
            handleChooseCategory(
                socket,
                data
            );
            break;

        case "nennenAnswer":
            handleNennenAnswer(
                socket,
                data
            );
            break;

        case "quizAnswer":
            handleQuizAnswer(
                socket,
                data
            );
            break;

        case "estimateAnswer":
            handleEstimateAnswer(
                socket,
                data
            );
            break;

        case "continueRound":
            handleContinueRound(
                socket
            );
            break;

        case "restart":
            handleRestart(
                socket
            );
            break;

        default:
            sendError(
                socket,
                "Unbekannter Nachrichtentyp."
            );
    }
}

/* =========================================================
   HTTP SERVER
========================================================= */

const server =
    http.createServer(
        (request, response) => {
            try {
                let requestPath =
                    decodeURIComponent(
                        request.url.split("?")[0]
                    );

                if (
                    requestPath ===
                    "/"
                ) {
                    requestPath =
                        "/index.html";
                }

                const filePath =
                    path.join(
                        __dirname,
                        requestPath
                    );

                const normalizedFilePath =
                    path.normalize(
                        filePath
                    );

                const normalizedRoot =
                    path.normalize(
                        __dirname
                    );

                if (
                    normalizedFilePath !==
                        normalizedRoot &&
                    !normalizedFilePath.startsWith(
                        normalizedRoot +
                            path.sep
                    )
                ) {
                    response.writeHead(
                        403
                    );

                    response.end(
                        "Forbidden"
                    );

                    return;
                }

                fs.stat(
                    normalizedFilePath,
                    (
                        error,
                        stats
                    ) => {
                        if (
                            error ||
                            !stats.isFile()
                        ) {
                            response.writeHead(
                                404
                            );

                            response.end(
                                "Not found"
                            );

                            return;
                        }

                        const extension =
                            path
                                .extname(
                                    normalizedFilePath
                                )
                                .toLowerCase();

                        const mimeTypes =
                            {
                                ".html":
                                    "text/html; charset=utf-8",

                                ".js":
                                    "text/javascript; charset=utf-8",

                                ".css":
                                    "text/css; charset=utf-8",

                                ".json":
                                    "application/json; charset=utf-8",

                                ".png":
                                    "image/png",

                                ".jpg":
                                    "image/jpeg",

                                ".jpeg":
                                    "image/jpeg",

                                ".gif":
                                    "image/gif",

                                ".svg":
                                    "image/svg+xml",

                                ".webp":
                                    "image/webp",

                                ".ico":
                                    "image/x-icon"
                            };

                        response.writeHead(
                            200,
                            {
                                "Content-Type":
                                    mimeTypes[
                                        extension
                                    ] ||
                                    "application/octet-stream"
                            }
                        );

                        fs.createReadStream(
                            normalizedFilePath
                        ).pipe(
                            response
                        );
                    }
                );
            } catch (error) {
                console.error(
                    "HTTP-Fehler:",
                    error
                );

                response.writeHead(
                    500
                );

                response.end(
                    "Internal Server Error"
                );
            }
        }
    );

/* =========================================================
   WEBSOCKET
========================================================= */

const wss =
    new WebSocket.Server({
        server
    });

wss.on(
    "connection",
    socket => {
        clients.add(socket);

        /*
            Sofort an ALLE bestehenden Clients
            den neuen Online-Stand senden.
        */
        broadcastOnlineCount();

        socket.on(
            "message",
            raw => {
                try {
                    const data =
                        JSON.parse(
                            raw.toString()
                        );

                    handleMessage(
                        socket,
                        data
                    );
                } catch (error) {
                    console.error(
                        "Nachrichtenfehler:",
                        error
                    );

                    sendError(
                        socket,
                        "Ungültige Servernachricht."
                    );
                }
            }
        );

        socket.on(
            "close",
            () => {
                handleDisconnect(
                    socket
                );

                clients.delete(
                    socket
                );

                /*
                    Nach dem Entfernen wird
                    der neue Stand versendet.
                */
                broadcastOnlineCount();
            }
        );

        socket.on(
            "error",
            error => {
                console.error(
                    "WebSocket-Fehler:",
                    error.message
                );
            }
        );
    }
);

/* =========================================================
   DISCONNECT
========================================================= */

function handleDisconnect(
    socket
) {
    const player =
        getPlayerBySocket(socket);

    if (!player) {
        return;
    }

    player.connections.delete(
        socket
    );

    if (
        player.connections.size > 0
    ) {
        return;
    }

    const room =
        getRoom(player);

    if (!room) {
        return;
    }

    /*
        Besitzer trennt sich:
        kompletter Raum wird geschlossen.
    */
    if (
        player.id ===
        room.ownerId
    ) {
        closeRoom(
            room,
            "Der Besitzer hat die Verbindung getrennt."
        );

        return;
    }

    /*
        Während eines laufenden Spiels wird
        ein vollständig getrennter Spieler entfernt.
    */
    if (
        room.phase !==
            "lobby" &&
        room.phase !==
            "category"
    ) {
        removePlayer(
            player,
            room
        );

        checkRunningGame(
            room
        );

        return;
    }

    sendStateToRoom(room);
}

/* =========================================================
   ONLINE-ZÄHLER AKTUALISIEREN
========================================================= */

/*
    Zusätzliche Sicherheitsaktualisierung alle 3 Sekunden.
    Dadurch bleibt der Zähler auch bei unerwarteten
    Browser-/Netzwerk-Situationen möglichst aktuell.
*/
setInterval(
    () => {
        broadcastOnlineCount();
    },
    3000
);

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
            `PORT: ${
                process.env.PORT ||
                "lokal 5500"
            }`
        );
    }
);

