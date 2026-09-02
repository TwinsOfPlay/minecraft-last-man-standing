
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 5500;

const MAX_PLAYERS = 16;
const TOTAL_ROUNDS = 3;
const QUESTIONS_PER_ROUND = 20;
const QUESTION_TIME_MS = 30_000;

const rooms = new Map();
const clients = new Set();
const playersById = new Map();
const playersByIdentity = new Map();

/* =========================================================
   QUIZ – SCHWERER FRAGENPOOL
========================================================= */

const quizQuestions = [
    {
        question: "Wie hoch ist die Wahrscheinlichkeit, dass ein natürlich gespawntes Baby-Schaf pink ist?",
        answers: ["0,00082 %", "0,0082 %", "0,082 %", "0,82 %"],
        correct: 1
    },
    {
        question: "Welche Verzauberung ist exklusiv für Keulen?",
        answers: ["Dichte", "Durchschlag", "Schlag", "Fluch der Bindung"],
        correct: 0
    },
    {
        question: "Welches dieser Tiere gehört zur von dir festgelegten Kategorie der neutralen Mobs?",
        answers: ["Warden", "Enderman", "Eisengolem", "Beide B und C"],
        correct: 3
    },
    {
        question: "Was entsteht, wenn man einen Feuerball eines Ghasts zurückschlägt?",
        answers: ["Ein Blaze", "Ein Geschoss bleibt erhalten", "Der Feuerball fliegt zurück", "Ein Enderauge"],
        correct: 2
    },
    {
        question: "Welche Verzauberung kann nicht gemeinsam mit Schärfe auf ein Schwert gelegt werden?",
        answers: ["Plünderung", "Bann der Arthropoden", "Verbrennung", "Keine der drei"],
        correct: 3
    },
    {
        question: "Welches Material benötigt man für einen vollständigen Netherite-Satz aus vier Rüstungsteilen zusätzlich zu Diamantrüstung?",
        answers: ["4 Netheritbarren", "8 Netheritbarren", "16 Netheritbarren", "24 Netheritbarren"],
        correct: 0
    },
    {
        question: "Wie viele Bücherregale werden für die maximale Verzauberungsstufe benötigt?",
        answers: ["12", "14", "15", "18"],
        correct: 2
    },
    {
        question: "Welcher dieser Mobs kann beim Spawnen natürlich mit einem Baby auftreten?",
        answers: ["Eisengolem", "Delfin", "Enderman", "Warden"],
        correct: 1
    },
    {
        question: "Welches dieser Items ist essbar?",
        answers: ["Spinnenauge", "Schießpulver", "Enderperle", "Leuchtbeeren"],
        correct: 0
    },
    {
        question: "Welche Verzauberung senkt beim Einsatz einer Keule den Fallschaden nach einem Fallangriff?",
        answers: ["Dichte", "Bann", "Lunge", "Keine"],
        correct: 3
    },
    {
        question: "Wie viele Enderaugen können theoretisch nötig sein, um ein vollständiges Endportal zu aktivieren?",
        answers: ["8", "10", "12", "16"],
        correct: 2
    },
    {
        question: "Welcher Block ist explosionsresistenter: Obsidian oder Stein?",
        answers: ["Stein", "Obsidian", "Gleich stark", "Kommt auf den Modus an"],
        correct: 1
    },
    {
        question: "Welche Verzauberung erhöht bei einer Keule den Schaden durch Fallhöhe?",
        answers: ["Dichte", "Lunge", "Durchschlag", "Rückstoß"],
        correct: 0
    },
    {
        question: "Welches Item kann ein Zombie natürlich droppen?",
        answers: ["Spinnenauge", "Karotte", "Enderauge", "Netheritbarren"],
        correct: 1
    },
    {
        question: "Welcher neutrale Mob kann einen Spieler durch einen Blickkontakt provozieren?",
        answers: ["Delfin", "Enderman", "Panda", "Kamel"],
        correct: 1
    },
    {
        question: "Wie viele Slots besitzt eine große Truhe?",
        answers: ["27", "36", "45", "54"],
        correct: 3
    },
    {
        question: "Welche dieser Verzauberungen gehört zur Kategorie 'Fluch'?",
        answers: ["Fluch des Verschwindens", "Dichte", "Lunge", "Reparatur"],
        correct: 0
    },
    {
        question: "Welches Material lässt einen Zaubertisch effektiv auf maximale Stufe bringen?",
        answers: ["15 Bücherregale", "16 Bücherregale", "18 Bücherregale", "20 Bücherregale"],
        correct: 0
    },
    {
        question: "Welches dieser Lebensmittel kann normalerweise gegessen werden, obwohl es nicht als 'typisches' Essen wirkt?",
        answers: ["Spinnenauge", "Kaktus", "Redstone", "Glowstone-Staub"],
        correct: 0
    },
    {
        question: "Welcher Mob aus dieser Liste ist neutral und nicht grundsätzlich feindlich?",
        answers: ["Creeper", "Skelett", "Wolf", "Warden"],
        correct: 2
    },
    {
        question: "Welche Verzauberung besitzt eine Keule namens 'Dichte' im Deutschen?",
        answers: ["Density", "Smash", "Impact", "Crush"],
        correct: 0
    },
    {
        question: "Was passiert mit einem Spieler mit 'Feather Falling'?",
        answers: ["Er fällt langsamer", "Er erleidet weniger Fallschaden", "Er springt höher", "Er bekommt keinen Schaden durch Explosionen"],
        correct: 1
    },
    {
        question: "Welcher dieser Gegenstände ist kein essbares Item?",
        answers: ["Verrottetes Fleisch", "Spinnenauge", "Goldene Karotte", "Enderperle"],
        correct: 3
    },
    {
        question: "Welcher Mob ist in deiner neutralen Liste enthalten?",
        answers: ["Händler-Lama", "Creeper", "Witch", "Warden"],
        correct: 0
    },
    {
        question: "Wie viele Herzen besitzt ein normaler Minecraft-Spieler?",
        answers: ["10", "15", "20", "25"],
        correct: 0
    }
];

/* =========================================================
   SCHÄTZFRAGEN – SCHWER / SEHR SCHWER
========================================================= */

const estimateQuestions = [
    {
        question: "Wie hoch ist die natürliche Spawn-Wahrscheinlichkeit für ein Baby-Pink-Schaf?",
        answer: 0.0082,
        unit: "%"
    },
    {
        question: "Wie hoch ist ungefähr die natürliche Spawn-Wahrscheinlichkeit für ein pinkes Schaf?",
        answer: 0.164,
        unit: "%"
    },
    {
        question: "Wie viele Slots hat eine große Truhe?",
        answer: 54,
        unit: ""
    },
    {
        question: "Wie viele Bücherregale werden für maximale Verzauberungen benötigt?",
        answer: 15,
        unit: ""
    },
    {
        question: "Wie viele Herzen hat ein Creeper?",
        answer: 10,
        unit: ""
    },
    {
        question: "Wie viele Herzen hat ein Enderman?",
        answer: 20,
        unit: ""
    },
    {
        question: "Wie viele Enderaugen können für ein vollständiges Endportal nötig sein?",
        answer: 12,
        unit: ""
    },
    {
        question: "Wie viele Slots hat die Hotbar?",
        answer: 9,
        unit: ""
    },
    {
        question: "Wie viele Minuten dauert ein vollständiger Minecraft-Tag?",
        answer: 20,
        unit: "Minuten"
    },
    {
        question: "Wie viele Blöcke weit fließt Wasser horizontal von einer Quelle?",
        answer: 7,
        unit: "Blöcke"
    },
    {
        question: "Wie viele Diamanten werden für eine vollständige Diamantrüstung benötigt?",
        answer: 24,
        unit: ""
    },
    {
        question: "Wie viele Obsidianblöcke benötigt ein minimales Netherportal?",
        answer: 10,
        unit: ""
    },
    {
        question: "Wie viele Erfahrungspunkte benötigt man ungefähr insgesamt von Level 0 bis Level 30?",
        answer: 1395,
        unit: "XP"
    },
    {
        question: "Wie viele Truhen-Slots hat ein Doppelkistenraum?",
        answer: 54,
        unit: ""
    },
    {
        question: "Wie viele Items passen maximal in einen normalen 64er-Stack?",
        answer: 64,
        unit: ""
    },
    {
        question: "Wie viele Blöcke hoch ist ein normaler Spieler ungefähr?",
        answer: 1.8,
        unit: "Blöcke"
    },
    {
        question: "Wie viele Herzen hat ein Zombie?",
        answer: 10,
        unit: ""
    },
    {
        question: "Wie viele Herzen hat ein Eisengolem?",
        answer: 100,
        unit: ""
    },
    {
        question: "Wie viele Slots besitzt eine Shulkerbox?",
        answer: 27,
        unit: ""
    },
    {
        question: "Wie viele Diamanten benötigt ein voller Beacon-Pyramidenaufbau auf maximaler Größe?",
        answer: 164,
        unit: "Diamantblöcke"
    },
    {
        question: "Wie viele Sekunden dauert ein vollständiger Minecraft-Tag ungefähr?",
        answer: 1200,
        unit: "Sekunden"
    },
    {
        question: "Wie viele Blöcke kann ein Redstone-Signal ohne Verstärker übertragen?",
        answer: 15,
        unit: "Blöcke"
    },
    {
        question: "Wie viele Herzen besitzt ein normaler Spieler inklusive voller Gesundheit?",
        answer: 20,
        unit: ""
    },
    {
        question: "Wie viele Slots hat ein normales Inventar inklusive Hotbar?",
        answer: 36,
        unit: ""
    },
    {
        question: "Wie viele Sekunden hat ein kompletter Minecraft-Tag?",
        answer: 1200,
        unit: "Sekunden"
    }
];

/* =========================================================
   NENNEN
========================================================= */

const nennenLists = {
    enchantments: [
        "Aquatic Affinity",
        "Bann",
        "Bindungsfluch",
        "Bruchschutz",
        "Dichte",
        "Dornen",
        "Effizienz",
        "Federfall",
        "Feuerschutz",
        "Feueraspekt",
        "Flamme",
        "Fluch des Verschwindens",
        "Glück",
        "Haltbarkeit",
        "Köder",
        "Lunge",
        "Multischuss",
        "Reparatur",
        "Rückstoß",
        "Schärfe",
        "Schnelligkeit",
        "Seelenläufer",
        "Schutz",
        "Stärke",
        "Wasserläufer",
        "Wasseratmung",
        "Weitwurf",
        "Durchschlag",
        "Plünderung",
        "Treue",
        "Impaling",
        "Channeling",
        "Glück des Meeres",
        "Sog"
    ],

    food: [
        "Apfel",
        "Goldener Apfel",
        "Verzauberter goldener Apfel",
        "Brot",
        "Karotte",
        "Goldene Karotte",
        "Kartoffel",
        "Ofenkartoffel",
        "Giftige Kartoffel",
        "Rote Bete",
        "Melonenscheibe",
        "Kuchen",
        "Keks",
        "Kürbiskuchen",
        "Pilzsuppe",
        "Hasenragout",
        "Rindfleisch",
        "Steak",
        "Schweinefleisch",
        "Schweinekotelett",
        "Hammelfleisch",
        "Gebratenes Hammelfleisch",
        "Huhn",
        "Gebratenes Huhn",
        "Kaninchen",
        "Gebratenes Kaninchen",
        "Fisch",
        "Gebratener Fisch",
        "Lachs",
        "Gebratener Lachs",
        "Tropenfisch",
        "Roher Kabeljau",
        "Verrottetes Fleisch",
        "Spinnenauge",
        "Milch",
        "Honigflasche",
        "Chorusfrucht",
        "Beeren",
        "Leuchtbeeren",
        "Süßbeeren",
        "Getrockneter Seetang",
        "Seetang"
    ],

    neutral: [
        "Biene",
        "Delfin",
        "Eisbär",
        "Eisengolem",
        "Enderman",
        "Händler-Lama",
        "Höhlenspinne",
        "Kamel",
        "Lama",
        "Panda",
        "Piglin",
        "Spinne",
        "Wolf",
        "Ziege",
        "Zombie Piglin",
        "Nautilus"
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

    let code;

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

function normalize(text) {
    return String(text ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function safeName(name) {
    return String(name ?? "")
        .trim()
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 20) || "Spieler";
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
        player =>
            isPlayerActive(player)
    );
}

function getPlayerBySocket(socket) {
    return socket?.playerId
        ? playersById.get(socket.playerId) || null
        : null;
}

function getRoom(player) {
    return player?.roomCode
        ? rooms.get(player.roomCode) || null
        : null;
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
        message
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

function clearRoomTimer(room) {
    if (
        room &&
        room.questionTimer
    ) {
        clearTimeout(
            room.questionTimer
        );

        room.questionTimer =
            null;
    }
}

/* =========================================================
   STATE
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
        ),
        lastRoundPoints:
            Number(
                player.lastRoundPoints ||
                0
            )
    };
}

function quizSubmissionFor(
    room,
    viewer
) {
    const game =
        room.game;

    if (!game) {
        return null;
    }

    const own =
        game.submissions[
            viewer.id
        ];

    const spyActive =
        game.jokerType ===
            "spy" &&
        game.jokerPlayerId ===
            viewer.id;

    const ownerSpectator =
        viewer.id ===
            room.ownerId &&
        room.ownerPlaying === false;

    if (
        !spyActive &&
        !ownerSpectator
    ) {
        return own
            ? [{
                id: viewer.id,
                name: viewer.name,
                answer: own.answer,
                answered: true
            }]
            : [];
    }

    return Object.entries(
        game.submissions
    ).map(
        ([id, submission]) => {
            const player =
                room.players.find(
                    p =>
                        p.id === id
                );

            return {
                id,
                name:
                    player?.name ||
                    "Spieler",
                answer:
                    submission.answer,
                answered:
                    true
            };
        }
    );
}

function estimateSubmissionsFor(
    room,
    viewer
) {
    const game =
        room.game;

    if (!game) {
        return [];
    }

    const spyActive =
        game.jokerType ===
            "spy" &&
        game.jokerPlayerId ===
            viewer.id;

    const ownerSpectator =
        viewer.id ===
            room.ownerId &&
        room.ownerPlaying === false;

    if (
        !spyActive &&
        !ownerSpectator
    ) {
        const own =
            game.submissions[
                viewer.id
            ];

        return own
            ? [{
                id: viewer.id,
                name: viewer.name,
                answer: own.answer,
                points: own.points,
                answered: true
            }]
            : [];
    }

    return Object.entries(
        game.submissions
    ).map(
        ([id, submission]) => {
            const player =
                room.players.find(
                    p =>
                        p.id === id
                );

            return {
                id,
                name:
                    player?.name ||
                    "Spieler",
                answer:
                    submission.answer,
                points:
                    submission.points,
                answered:
                    true
            };
        }
    );
}

function answeredStatus(
    room
) {
    return getActivePlayers(room)
        .map(
            player => ({
                id: player.id,
                name: player.name,
                answered:
                    Boolean(
                        room.game?.submissions[
                            player.id
                        ]
                    )
            })
        );
}

function buildState(
    room,
    viewer
) {
    const state = {
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
            viewer.id,

        isOwner:
            viewer.id ===
            room.ownerId,

        ownerPlaying:
            room.ownerPlaying === true,

        players:
            room.players.map(
                serializePlayer
            ),

        podium:
            room.podium || null,

        results:
            room.results || null,

        final:
            room.final || null,

        nennen:
            null,

        quiz:
            null,

        estimate:
            null
    };

    if (
        room.phase ===
        "nennen"
    ) {
        state.nennen = {
            round:
                room.round,

            totalRounds:
                TOTAL_ROUNDS,

            title:
                "Nennen",

            description:
                room.game?.prompt ||
                "",

            category:
                room.game?.nennenCategory ||
                "neutral",

            currentPlayerId:
                room.game?.currentPlayerId ||
                null,

            turnEndsAt:
                room.game?.turnEndsAt ||
                null,

            usedAnswers:
                room.game
                    ? [
                        ...room.game.usedAnswers
                    ]
                    : []
        };
    }

    if (
        room.phase ===
        "quiz"
    ) {
        const game =
            room.game;

        const own =
            game?.submissions[
                viewer.id
            ];

        const removed =
            own?.fiftyFiftyRemoved ||
            [];

        state.quiz = {
            round:
                room.round,

            totalRounds:
                TOTAL_ROUNDS,

            number:
                game.questionIndex +
                1,

            totalQuestions:
                QUESTIONS_PER_ROUND,

            question:
                game.current.question,

            answers:
                game.current.answers,

            visibleAnswerIndexes:
                game.current.answers
                    .map(
                        (_, index) =>
                            !removed.includes(
                                index
                            )
                    ),

            currentPlayerId:
                null,

            turnEndsAt:
                game.turnEndsAt,

            answered:
                Boolean(
                    game.submissions[
                        viewer.id
                    ]
                ),

            submissions:
                quizSubmissionFor(
                    room,
                    viewer
                ),

            playersStatus:
                answeredStatus(
                    room
                ),

            jokerUsed:
                Boolean(
                    game.jokerUsed
                ),

            jokerType:
                game.jokerType ||
                null,

            jokerPlayerName:
                game.jokerPlayerId
                    ? room.players.find(
                        p =>
                            p.id ===
                            game.jokerPlayerId
                    )?.name || null
                    : null,

            fiftyFiftyRemoved:
                removed,

            feedback:
                own?.feedback ||
                null,

            spyAnswers:
                game.jokerType ===
                    "spy" &&
                game.jokerPlayerId ===
                    viewer.id
                    ? quizSubmissionFor(
                        room,
                        viewer
                    )
                    : [],

            ownerCanSkip:
                viewer.id ===
                    room.ownerId &&
                room.ownerPlaying ===
                    false
        };
    }

    if (
        room.phase ===
        "estimate"
    ) {
        const game =
            room.game;

        const own =
            game?.submissions[
                viewer.id
            ];

        state.estimate = {
            round:
                room.round,

            totalRounds:
                TOTAL_ROUNDS,

            number:
                game.questionIndex +
                1,

            totalQuestions:
                QUESTIONS_PER_ROUND,

            question:
                game.current.question,

            currentPlayerId:
                null,

            turnEndsAt:
                game.turnEndsAt,

            answered:
                Boolean(own),

            submissions:
                estimateSubmissionsFor(
                    room,
                    viewer
                ),

            playersStatus:
                answeredStatus(
                    room
                ),

            jokerUsed:
                Boolean(
                    game.jokerUsed
                ),

            jokerType:
                game.jokerType ||
                null,

            jokerPlayerName:
                game.jokerPlayerId
                    ? room.players.find(
                        p =>
                            p.id ===
                            game.jokerPlayerId
                    )?.name || null
                    : null,

            fiftyFiftyRange:
                own?.fiftyFiftyRange ||
                null,

            feedback:
                own?.feedback ||
                null,

            ownerCanSkip:
                viewer.id ===
                    room.ownerId &&
                room.ownerPlaying ===
                    false
        };
    }

    return state;
}

function sendStateToRoom(room) {
    for (
        const player of room.players
    ) {
        for (
            const socket of player.connections
        ) {
            send(socket, {
                type:
                    "state",
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

function attachSocket(
    player,
    socket
) {
    player.connections.add(
        socket
    );

    socket.playerId =
        player.id;
}

function createRoom(player) {
    const code =
        randomRoomCode();

    const room = {
        code,

        ownerId:
            player.id,

        ownerPlaying:
            true,

        players:
            [player],

        phase:
            "lobby",

        category:
            null,

        round:
            0,

        game:
            null,

        questionTimer:
            null,

        podium:
            null,

        results:
            null,

        final:
            null
    };

    player.roomCode =
        room.code;

    player.owner =
        true;

    player.playing =
        true;

    rooms.set(
        room.code,
        room
    );

    return room;
}

function closeRoom(
    room,
    message =
        "Der Raum wurde geschlossen."
) {
    clearRoomTimer(room);

    for (
        const player of room.players
    ) {
        player.roomCode =
            null;

        for (
            const socket of player.connections
        ) {
            send(socket, {
                type:
                    "leftRoom"
            });

            send(socket, {
                type:
                    "error",
                message
            });
        }
    }

    rooms.delete(
        room.code
    );
}

/* =========================================================
   RUNDE STARTEN
========================================================= */

function startGame(
    room
) {
    const active =
        getActivePlayers(room);

    if (
        active.length < 2
    ) {
        return false;
    }

    room.round =
        1;

    room.phase =
        "category";

    room.category =
        null;

    room.podium =
        null;

    room.results =
        null;

    room.final =
        null;

    for (
        const player of room.players
    ) {
        player.score = 0;
        player.lastRoundPoints = 0;
    }

    sendStateToRoom(room);

    return true;
}

/* =========================================================
   NENNEN
========================================================= */

function startNennenCategory(
    room,
    category
) {
    const active =
        getActivePlayers(room);

    if (
        active.length < 2
    ) {
        finishGame(
            room,
            "Mindestens 2 aktive Spieler werden benötigt."
        );

        return;
    }

    const list =
        nennenLists[category];

    if (!list) {
        return;
    }

    const order =
        shuffle(active);

    room.category =
        category;

    room.phase =
        "nennen";

    room.game = {
        nennenCategory:
            category,

        prompt:
            category ===
                "enchantments"
                ? "Nenne ein Verzauberungs-Buch."
                : category ===
                    "food"
                    ? "Nenne ein essbares Item."
                    : "Nenne einen neutralen Mob.",

        list:
            [...list],

        remaining:
            new Set(
                list.map(
                    normalize
                )
            ),

        usedAnswers:
            new Set(),

        order:
            order.map(
                p =>
                    p.id
            ),

        turnIndex:
            0,

        currentPlayerId:
            order[0].id,

        turnEndsAt:
            Date.now() +
            QUESTION_TIME_MS,

        successCounts:
            {},

        failedPlayerId:
            null
    };

    clearRoomTimer(room);

    room.questionTimer =
        setTimeout(
            () => {
                if (
                    room.phase !==
                    "nennen"
                ) {
                    return;
                }

                finishNennen(
                    room,
                    room.game
                        .currentPlayerId
                );
            },
            QUESTION_TIME_MS
        );

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

    const answer =
        normalize(
            data?.answer
        );

    if (!answer) {
        return;
    }

    if (
        room.game.usedAnswers.has(
            answer
        )
    ) {
        finishNennen(
            room,
            player.id
        );

        return;
    }

    if (
        !room.game.remaining.has(
            answer
        )
    ) {
        finishNennen(
            room,
            player.id
        );

        return;
    }

    room.game.usedAnswers.add(
        answer
    );

    room.game.remaining.delete(
        answer
    );

    room.game.successCounts[
        player.id
    ] =
        (
            room.game.successCounts[
                player.id
            ] || 0
        ) + 1;

    /*
        Sind alle Begriffe verbraucht,
        bekommen alle noch aktiven Spieler
        die maximale Punktzahl.
    */
    if (
        room.game.remaining.size ===
        0
    ) {
        finishNennen(
            room,
            null,
            true
        );

        return;
    }

    nextNennenPlayer(room);
}

function nextNennenPlayer(
    room
) {
    const active =
        getActivePlayers(room);

    if (
        active.length < 2
    ) {
        finishGame(
            room,
            "Es sind nicht mehr genügend aktive Spieler übrig."
        );

        return;
    }

    room.game.order =
        room.game.order.filter(
            id =>
                active.some(
                    p =>
                        p.id === id
                )
        );

    if (
        !room.game.order.length
    ) {
        finishNennen(
            room,
            null
        );

        return;
    }

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
        QUESTION_TIME_MS;

    clearRoomTimer(room);

    room.questionTimer =
        setTimeout(
            () => {
                finishNennen(
                    room,
                    room.game.currentPlayerId
                );
            },
            QUESTION_TIME_MS
        );

    sendStateToRoom(room);
}

function finishNennen(
    room,
    failedPlayerId = null,
    allFinished = false
) {
    clearRoomTimer(room);

    const active =
        getActivePlayers(room);

    if (!active.length) {
        finishGame(
            room
        );
        return;
    }

    const counts =
        active.map(
            player => ({
                player,
                count:
                    room.game.successCounts[
                        player.id
                    ] || 0
            })
        );

    const highest =
        Math.max(
            ...counts.map(
                item =>
                    item.count
            )
        );

    if (allFinished) {
        for (
            const item of counts
        ) {
            item.player.lastRoundPoints =
                active.length;

            item.player.score +=
                active.length;
        }
    } else {
        /*
            Punkte richten sich nach der
            Teilnehmerzahl und der erreichten
            Überlebenshöhe.

            Spieler mit gleicher maximaler
            Anzahl bekommen dieselbe Punktzahl.
        */
        const sorted =
            [...counts].sort(
                (a, b) =>
                    b.count -
                    a.count
            );

        let rank =
            active.length;

        let previousCount =
            null;

        for (
            const item of sorted
        ) {
            if (
                previousCount !== null &&
                item.count !== previousCount
            ) {
                rank--;
            }

            item.player.lastRoundPoints =
                Math.max(
                    0,
                    rank
                );

            item.player.score +=
                item.player.lastRoundPoints;

            previousCount =
                item.count;
        }

        if (
            failedPlayerId
        ) {
            const failed =
                active.find(
                    p =>
                        p.id ===
                        failedPlayerId
                );

            if (failed) {
                failed.lastRoundPoints =
                    0;
            }
        }
    }

    preparePodium(
        room,
        "nennen"
    );
}

/* =========================================================
   QUIZ
========================================================= */

function selectQuestions(
    pool
) {
    return shuffle(pool)
        .slice(
            0,
            Math.min(
                QUESTIONS_PER_ROUND,
                pool.length
            )
        );
}

function startQuiz(
    room
) {
    const active =
        getActivePlayers(room);

    if (
        active.length < 2
    ) {
        finishGame(
            room,
            "Mindestens 2 aktive Spieler werden benötigt."
        );

        return;
    }

    room.phase =
        "quiz";

    const questions =
        selectQuestions(
            quizQuestions
        );

    room.game = {
        questions,

        questionIndex:
            0,

        current:
            questions[0],

        submissions:
            {},

        jokerUsed:
            false,

        jokerType:
            null,

        jokerPlayerId:
            null,

        turnEndsAt:
            Date.now() +
            QUESTION_TIME_MS
    };

    startQuestionTimer(room);

    sendStateToRoom(room);
}

function startQuestionTimer(
    room
) {
    clearRoomTimer(room);

    room.game.turnEndsAt =
        Date.now() +
        QUESTION_TIME_MS;

    room.questionTimer =
        setTimeout(
            () => {
                advanceQuiz(
                    room,
                    true
                );
            },
            QUESTION_TIME_MS
        );
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
        room.game.submissions[
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
        ) ||
        answer <
            0 ||
        answer >=
            room.game.current.answers.length
    ) {
        return;
    }

    const isCorrect =
        answer ===
        room.game.current.correct;

    room.game.submissions[
        player.id
    ] = {
        answer,
        correct:
            isCorrect
    };

    player.lastRoundPoints =
        isCorrect
            ? 1
            : 0;

    if (isCorrect) {
        player.score += 1;
    }

    room.game.submissions[
        player.id
    ].feedback =
        isCorrect
            ? {
                type: "correct",
                message:
                    `Korrekt (${String.fromCharCode(65 + room.game.current.correct)})`
            }
            : {
                type: "wrong",
                message:
                    `Falsch (${String.fromCharCode(65 + room.game.current.correct)})`
            };

    sendStateToRoom(room);

    if (
        allPlayersAnswered(room)
    ) {
        setTimeout(
            () =>
                advanceQuiz(
                    room,
                    false
                ),
            900
        );
    }
}

function allPlayersAnswered(
    room
) {
    const active =
        getActivePlayers(room);

    return (
        active.length > 0 &&
        active.every(
            player =>
                Boolean(
                    room.game.submissions[
                        player.id
                    ]
                )
        )
    );
}

/* =========================================================
   JOKER
========================================================= */

function handleUseJoker(
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
        (
            room.phase !==
                "quiz" &&
            room.phase !==
                "estimate"
        ) ||
        !room.game
    ) {
        return;
    }

    /*
        Pro Frage genau EIN Joker insgesamt.
    */
    if (
        room.game.jokerUsed
    ) {
        sendError(
            socket,
            "Für diese Frage wurde bereits ein Joker benutzt."
        );

        return;
    }

    const joker =
        String(
            data?.joker || ""
        ).toLowerCase();

    if (
        joker !==
            "fifty" &&
        joker !==
            "spy"
    ) {
        return;
    }

    /*
        Spy erst nach eigener Antwort.
    */
    if (
        joker === "spy" &&
        !room.game.submissions[
            player.id
        ]
    ) {
        sendError(
            socket,
            "Den Spy Joker kannst du erst nach deiner Antwort benutzen."
        );

        return;
    }

    room.game.jokerUsed =
        true;

    room.game.jokerType =
        joker === "fifty"
            ? "fifty"
            : "spy";

    room.game.jokerPlayerId =
        player.id;

    if (
        room.phase ===
        "quiz" &&
        joker === "fifty"
    ) {
        const wrongIndexes =
            room.game.current.answers
                .map(
                    (_, index) =>
                        index
                )
                .filter(
                    index =>
                        index !==
                        room.game.current.correct
                );

        const removed =
            shuffle(
                wrongIndexes
            ).slice(
                0,
                2
            );

        const submission =
            room.game.submissions[
                player.id
            ] || {};

        submission.fiftyFiftyRemoved =
            removed;

        room.game.submissions[
            player.id
        ] =
            submission;
    }

    if (
        room.phase ===
        "estimate" &&
        joker === "fifty"
    ) {
        const correct =
            Number(
                room.game.current.answer
            );

        const spread =
            Math.max(
                Math.abs(correct) *
                    0.25,
                1
            );

        const range = [
            Math.max(
                0,
                correct - spread
            ),
            correct + spread
        ];

        const submission =
            room.game.submissions[
                player.id
            ] || {};

        submission.fiftyFiftyRange =
            range;

        room.game.submissions[
            player.id
        ] =
            submission;
    }

    sendStateToRoom(room);
}

/* =========================================================
   QUIZ WEITER
========================================================= */

function advanceQuiz(
    room,
    timeout = false
) {
    if (
        room.phase !==
        "quiz" ||
        !room.game
    ) {
        return;
    }

    clearRoomTimer(room);

    const active =
        getActivePlayers(room);

    for (
        const player of active
    ) {
        if (
            !room.game.submissions[
                player.id
            ]
        ) {
            player.lastRoundPoints =
                0;
        }
    }

    room.game.questionIndex++;

    if (
        room.game.questionIndex >=
        QUESTIONS_PER_ROUND
    ) {
        preparePodium(
            room,
            "quiz"
        );

        return;
    }

    room.game.current =
        room.game.questions[
            room.game.questionIndex
        ];

    room.game.submissions =
        {};

    room.game.jokerUsed =
        false;

    room.game.jokerType =
        null;

    room.game.jokerPlayerId =
        null;

    startQuestionTimer(room);

    sendStateToRoom(room);
}

/* =========================================================
   ESTIMATE
========================================================= */

function startEstimate(
    room
) {
    const active =
        getActivePlayers(room);

    if (
        active.length < 2
    ) {
        finishGame(
            room,
            "Mindestens 2 aktive Spieler werden benötigt."
        );

        return;
    }

    room.phase =
        "estimate";

    const questions =
        selectQuestions(
            estimateQuestions
        );

    room.game = {
        questions,

        questionIndex:
            0,

        current:
            questions[0],

        submissions:
            {},

        jokerUsed:
            false,

        jokerType:
            null,

        jokerPlayerId:
            null,

        turnEndsAt:
            Date.now() +
            QUESTION_TIME_MS
    };

    startQuestionTimer(room);

    sendStateToRoom(room);
}

function calculateEstimatePoints(
    guess,
    correct
) {
    if (
        guess ===
        correct
    ) {
        return 5;
    }

    if (
        correct === 0
    ) {
        return 0;
    }

    const percentage =
        Math.abs(
            guess -
            correct
        ) /
        Math.abs(correct) *
        100;

    if (
        percentage <=
        1
    ) {
        return 4;
    }

    if (
        percentage <=
        5
    ) {
        return 3;
    }

    if (
        percentage <=
        10
    ) {
        return 2;
    }

    if (
        percentage <=
        20
    ) {
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
        room.game.submissions[
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

    const correct =
        Number(
            room.game.current.answer
        );

    const points =
        calculateEstimatePoints(
            guess,
            correct
        );

    room.game.submissions[
        player.id
    ] = {
        answer:
            guess,

        points,

        feedback:
            `${formatNumber(guess)}${room.game.current.unit ? " " + room.game.current.unit : ""} (+${points} Punkte)`
    };

    player.lastRoundPoints =
        points;

    player.score +=
        points;

    sendStateToRoom(room);

    if (
        allPlayersAnswered(room)
    ) {
        setTimeout(
            () =>
                advanceEstimate(
                    room
                ),
            900
        );
    }
}

function formatNumber(
    value
) {
    return Number(
        value
    ).toLocaleString(
        "de-DE",
        {
            maximumFractionDigits:
                4
        }
    );
}

function advanceEstimate(
    room
) {
    if (
        room.phase !==
        "estimate" ||
        !room.game
    ) {
        return;
    }

    clearRoomTimer(room);

    room.game.questionIndex++;

    if (
        room.game.questionIndex >=
        QUESTIONS_PER_ROUND
    ) {
        preparePodium(
            room,
            "estimate"
        );

        return;
    }

    room.game.current =
        room.game.questions[
            room.game.questionIndex
        ];

    room.game.submissions =
        {};

    room.game.jokerUsed =
        false;

    room.game.jokerType =
        null;

    room.game.jokerPlayerId =
        null;

    startQuestionTimer(room);

    sendStateToRoom(room);
}

/* =========================================================
   PODIUM
========================================================= */

function preparePodium(
    room,
    source
) {
    clearRoomTimer(room);

    room.phase =
        "podium";

    const active =
        getAllActivePlayers(room)
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            );

    room.podium = {
        source,

        players:
            active
                .slice(0, 3)
                .map(
                    player => ({
                        id:
                            player.id,

                        name:
                            player.name,

                        score:
                            Number(
                                player.score ||
                                0
                            ),

                        roundPoints:
                            Number(
                                player.lastRoundPoints ||
                                0
                            )
                    })
                )
    };

    room.game =
        null;

    sendStateToRoom(room);
}

/* =========================================================
   WEITER NACH PODEST
========================================================= */

function handlePodiumContinue(
    socket
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
            "podium"
    ) {
        return;
    }

    if (
        player.id !==
        room.ownerId
    ) {
        return;
    }

    if (
        room.round >=
        TOTAL_ROUNDS
    ) {
        createFinal(
            room
        );

        return;
    }

    room.round++;

    room.phase =
        "category";

    room.category =
        null;

    room.podium =
        null;

    room.results =
        null;

    sendStateToRoom(room);
}

function createFinal(
    room
) {
    room.phase =
        "final";

    const players =
        getAllActivePlayers(room)
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            );

    room.final = {
        winner:
            players[0]
                ? {
                    name:
                        players[0].name,

                    score:
                        players[0].score
                }
                : null,

        players:
            players.map(
                player => ({
                    id:
                        player.id,

                    name:
                        player.name,

                    score:
                        Number(
                            player.score ||
                            0
                        )
                })
            )
    };

    room.podium =
        null;

    sendStateToRoom(room);
}

/* =========================================================
   FINAL -> KATEGORIE
========================================================= */

function handleBackToCategories(
    socket
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

    room.phase =
        "category";

    room.category =
        null;

    room.final =
        null;

    room.round =
        1;

    for (
        const p of room.players
    ) {
        p.score = 0;
        p.lastRoundPoints = 0;
    }

    sendStateToRoom(room);
}

/* =========================================================
   NEXT ROUND / CATEGORY
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

    if (
        !room ||
        player.id !==
            room.ownerId
    ) {
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
            data?.category ||
            ""
        ).toLowerCase();

    if (
        category ===
            "nennen"
    ) {
        room.category =
            "nennen";

        room.phase =
            "nennenCategory";

        sendStateToRoom(room);

        return;
    }

    if (
        category ===
        "quiz"
    ) {
        startQuiz(room);
        return;
    }

    if (
        category ===
        "estimate"
    ) {
        startEstimate(room);
    }
}

function handleChooseNennenCategory(
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
        "nennenCategory"
    ) {
        return;
    }

    const category =
        String(
            data?.category ||
            ""
        ).toLowerCase();

    if (
        !nennenLists[
            category
        ]
    ) {
        return;
    }

    startNennenCategory(
        room,
        category
    );
}

/* =========================================================
   OWNER / PARTICIPATION
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
            room.ownerId ||
        room.phase !==
            "lobby"
    ) {
        return;
    }

    player.playing =
        data?.playing ===
        true;

    room.ownerPlaying =
        player.playing;

    sendStateToRoom(room);
}

/* =========================================================
   ROOM EXIT
========================================================= */

function removePlayer(
    player,
    room
) {
    const index =
        room.players.findIndex(
            p =>
                p.id ===
                player.id
        );

    if (
        index !== -1
    ) {
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
            type:
                "leftRoom"
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
        type:
            "leftRoom"
    });

    if (
        getActivePlayers(room)
            .length < 2 &&
        ![
            "lobby",
            "category",
            "nennenCategory",
            "results",
            "final",
            "podium"
        ].includes(
            room.phase
        )
    ) {
        finishGame(
            room,
            "Es sind nicht mehr genügend aktive Spieler übrig."
        );

        return;
    }

    sendStateToRoom(room);
}

/* =========================================================
   FINISH GAME
========================================================= */

function finishGame(
    room,
    message =
        "Spiel beendet."
) {
    clearRoomTimer(room);

    room.phase =
        "final";

    const players =
        getAllActivePlayers(room)
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            );

    room.final = {
        message,

        winner:
            players[0]
                ? {
                    name:
                        players[0].name,

                    score:
                        players[0].score
                }
                : null,

        players:
            players.map(
                player => ({
                    id:
                        player.id,

                    name:
                        player.name,

                    score:
                        Number(
                            player.score ||
                            0
                        )
                })
            )
    };

    room.game =
        null;

    sendStateToRoom(room);
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

    if (
        !room ||
        player.id !==
            room.ownerId
    ) {
        return;
    }

    clearRoomTimer(room);

    room.phase =
        "lobby";

    room.category =
        null;

    room.round =
        0;

    room.game =
        null;

    room.podium =
        null;

    room.results =
        null;

    room.final =
        null;

    for (
        const p of room.players
    ) {
        p.score = 0;
        p.lastRoundPoints = 0;
    }

    sendStateToRoom(room);
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
            data?.identityId ||
            ""
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

    attachSocket(
        player,
        socket
    );

    send(socket, {
        type:
            "identified",

        playerId:
            player.id,

        identityId:
            player.identityId,

        name:
            player.name
    });

    broadcastOnlineCount();

    const room =
        getRoom(player);

    if (room) {
        send(socket, {
            type:
                "state",

            state:
                buildState(
                    room,
                    player
                )
        });
    }
}

/* =========================================================
   CREATE
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

        attachSocket(
            player,
            socket
        );
    }

    if (
        player.roomCode
    ) {
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
        createRoom(
            player
        );

    send(socket, {
        type:
            "roomCreated",

        code:
            room.code
    });

    sendStateToRoom(room);
}

/* =========================================================
   JOIN
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

        attachSocket(
            player,
            socket
        );
    }

    if (
        player.roomCode
    ) {
        sendError(
            socket,
            "Du bist bereits in einem Raum."
        );

        return;
    }

    const code =
        String(
            data?.code ||
            ""
        )
            .trim()
            .toUpperCase();

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

    attachSocket(
        player,
        socket
    );

    send(socket, {
        type:
            "joinedRoom",

        code:
            room.code
    });

    sendStateToRoom(room);
}

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

    if (
        [
            "quiz",
            "estimate",
            "nennen"
        ].includes(
            room.phase
        )
    ) {
        removePlayer(
            player,
            room
        );

        if (
            getActivePlayers(room)
                .length < 2
        ) {
            finishGame(
                room,
                "Es sind nicht mehr genügend aktive Spieler übrig."
            );

            return;
        }
    }

    sendStateToRoom(room);
}

/* =========================================================
   MESSAGE HANDLER
========================================================= */

function handleMessage(
    socket,
    data
) {
    switch (
        String(
            data?.type ||
            ""
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
            {
                const player =
                    getPlayerBySocket(
                        socket
                    );

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
                    !startGame(room)
                ) {
                    sendError(
                        socket,
                        "Mindestens 2 aktive Spieler werden benötigt."
                    );
                }
            }
            break;

        case "chooseCategory":
            handleChooseCategory(
                socket,
                data
            );
            break;

        case "chooseNennenCategory":
            handleChooseNennenCategory(
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

        case "useJoker":
            handleUseJoker(
                socket,
                data
            );
            break;

        case "skipQuestion":
            {
                const player =
                    getPlayerBySocket(
                        socket
                    );

                const room =
                    getRoom(player);

                if (
                    room &&
                    player.id ===
                        room.ownerId &&
                    room.ownerPlaying ===
                        false &&
                    (
                        room.phase ===
                            "quiz" ||
                        room.phase ===
                            "estimate"
                    )
                ) {
                    if (
                        room.phase ===
                        "quiz"
                    ) {
                        advanceQuiz(
                            room,
                            true
                        );
                    } else {
                        advanceEstimate(
                            room
                        );
                    }
                }
            }
            break;

        case "podiumContinue":
            handlePodiumContinue(
                socket
            );
            break;

        case "backToCategories":
            handleBackToCategories(
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

                const normalizedRoot =
                    path.normalize(
                        __dirname
                    );

                const normalizedFile =
                    path.normalize(
                        filePath
                    );

                if (
                    normalizedFile !==
                        normalizedRoot &&
                    !normalizedFile.startsWith(
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
                    normalizedFile,
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

                        const ext =
                            path.extname(
                                normalizedFile
                            ).toLowerCase();

                        const mime = {
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
                                    mime[
                                        ext
                                    ] ||
                                    "application/octet-stream"
                            }
                        );

                        fs.createReadStream(
                            normalizedFile
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
                        "Message-Fehler:",
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
   ONLINE COUNT
========================================================= */

setInterval(
    () => {
        broadcastOnlineCount();
    },
    3000
);

/* =========================================================
   START
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

