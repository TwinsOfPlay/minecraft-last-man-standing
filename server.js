const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const HOST = "127.0.0.1";
const PORT = 5500;

const rooms = new Map();
const clients = new Set();

let nextPlayerId = 1;

const NENNEN_ROUNDS = [
    {
        title: "Alle Minecraft-Verzauberungen",
        description:
            "Nennt abwechselnd eine gültige Minecraft-Verzauberung. Keine Wiederholungen.",
        type: "enchantments",
        answers: [
            "Aqua Affinity",
            "Bane of Arthropods",
            "Blast Protection",
            "Breach",
            "Channeling",
            "Curse of Binding",
            "Curse of Vanishing",
            "Depth Strider",
            "Efficiency",
            "Feather Falling",
            "Fire Aspect",
            "Fire Protection",
            "Flame",
            "Fortune",
            "Frost Walker",
            "Impaling",
            "Infinity",
            "Knockback",
            "Looting",
            "Loyalty",
            "Luck of the Sea",
            "Lure",
            "Mending",
            "Multishot",
            "Piercing",
            "Power",
            "Projectile Protection",
            "Protection",
            "Punch",
            "Quick Charge",
            "Respiration",
            "Riptide",
            "Sharpness",
            "Silk Touch",
            "Smite",
            "Soul Speed",
            "Sweeping Edge",
            "Swift Sneak",
            "Thorns",
            "Unbreaking",
            "Wind Burst"
        ]
    },

    {
        title: "Alle essbaren Items",
        description:
            "Nennt abwechselnd ein essbares Minecraft-Item. Keine Wiederholungen.",
        type: "food",
        answers: [
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
            "Rote-Bete-Suppe",
            "Pilzsuppe",
            "Kaninchenragout",
            "Steak",
            "Gebratenes Schweinekotelett",
            "Gebratenes Hühnchen",
            "Gebratener Kabeljau",
            "Gebratener Lachs",
            "Gebratenes Hammelfleisch",
            "Gebratenes Kaninchen",
            "Getrockneter Seetang",
            "Melonenscheibe",
            "Kürbiskuchen",
            "Keks",
            "Kuchen",
            "Süßbeeren",
            "Leuchtbeeren",
            "Chorusfrucht",
            "Honigflasche",
            "Milch",
            "Fisch",
            "Kugelfisch"
        ]
    },

    {
        title: "Mobs, die nicht immer angreifen",
        description:
            "Nennt abwechselnd einen Mob, der den Spieler nicht immer automatisch angreift. Keine Wiederholungen.",
        type: "mobs",
        answers: [
            "Axolotl",
            "Biene",
            "Eisbär",
            "Fuchs",
            "Geist",
            "Huhn",
            "Kuh",
            "Katze",
            "Kaninchen",
            "Lama",
            "Mooshroom",
            "Nautilus",
            "Ozelot",
            "Panda",
            "Papagei",
            "Pferd",
            "Schaf",
            "Schwein",
            "Schneegolem",
            "Tintenfisch",
            "Wasserschwein",
            "Wolf",
            "Ziege",
            "Delfin",
            "Schildkröte",
            "Armadillo",
            "Gürteltier"
        ]
    }
];

const QUIZ_QUESTIONS = [
    {
        question: "Welches Erz ist am seltensten?",
        answers: ["Kohle", "Eisen", "Diamant", "Kupfer"],
        correct: 2
    },
    {
        question: "Wie viele Herzen hat ein normaler Spieler?",
        answers: ["5", "10", "20", "40"],
        correct: 1
    },
    {
        question: "Welcher Mob explodiert?",
        answers: ["Zombie", "Creeper", "Skeleton", "Spider"],
        correct: 1
    },
    {
        question: "Wie heißt die Dimension mit dem Enderdrachen?",
        answers: ["Nether", "End", "Aether", "Deep Dark"],
        correct: 1
    },
    {
        question: "Welches Item braucht man für ein Netherportal?",
        answers: ["Obsidian", "Diamant", "Endstein", "Bedrock"],
        correct: 0
    },
    {
        question: "Was droppt ein Creeper normalerweise?",
        answers: ["Knochen", "Faden", "Schießpulver", "Leder"],
        correct: 2
    },
    {
        question: "Welche Spitzhacke kann Diamanterz abbauen?",
        answers: [
            "Holzspitzhacke",
            "Steinspitzhacke",
            "Eisenspitzhacke",
            "Goldspitzhacke"
        ],
        correct: 2
    },
    {
        question: "Wie viele Blöcke hoch ist ein normaler Spieler ungefähr?",
        answers: [
            "1 Block",
            "1,8 Blöcke",
            "3 Blöcke",
            "4 Blöcke"
        ],
        correct: 1
    },
    {
        question: "Welcher Mob kann durch Wände teleportieren?",
        answers: [
            "Enderman",
            "Zombie",
            "Kuh",
            "Hexe"
        ],
        correct: 0
    },
    {
        question: "Was benötigt man zum Herstellen eines Bettes?",
        answers: [
            "3 Wolle + 3 Bretter",
            "6 Wolle",
            "3 Leder + 3 Bretter",
            "3 Wolle + 3 Eisen"
        ],
        correct: 0
    },
    {
        question: "Welche Pflanze wächst auf Netherboden?",
        answers: [
            "Weizen",
            "Netherwarze",
            "Karotte",
            "Zuckerrohr"
        ],
        correct: 1
    },
    {
        question: "Welcher Mob kann Tridents werfen?",
        answers: [
            "Drowned",
            "Zombie",
            "Pillager",
            "Husk"
        ],
        correct: 0
    }
];

const ESTIMATE_QUESTIONS = [
    {
        question: "Wie viele Blöcke hoch ist ein Enderman?",
        answer: 3
    },
    {
        question: "Wie viele verschiedene Farben kann ein Schaf natürlich haben?",
        answer: 4
    },
    {
        question: "Wie viele Slots hat eine normale große Truhe?",
        answer: 54
    },
    {
        question:
            "Wie viele Bücherregale braucht man maximal für einen Level-30-Verzauberungstisch?",
        answer: 15
    },
    {
        question:
            "Wie viele Eisenbarren benötigt man für eine komplette Eisenrüstung?",
        answer: 24
    },
    {
        question:
            "Wie viele Obsidianblöcke benötigt ein minimales Netherportal?",
        answer: 10
    },
    {
        question: "Wie viele Herzen hat ein Enderdrache?",
        answer: 100
    },
    {
        question:
            "Wie viele Pfeile kann ein Skelett maximal fallen lassen, wenn Looting nicht zählt?",
        answer: 2
    },
    {
        question:
            "Wie viele Holzplanken braucht man für eine Werkbank?",
        answer: 4
    },
    {
        question:
            "Wie viele Augen benötigt man theoretisch maximal für ein Endportal?",
        answer: 12
    }
];

function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [result[i], result[j]] = [
            result[j],
            result[i]
        ];
    }

    return result;
}

function makeRoomCode() {
    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

function makePlayerId() {
    return `player-${nextPlayerId++}`;
}

function cleanName(name) {
    return String(name || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 20);
}

function normalizeAnswer(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/ß/g, "ss")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9äöü\s-]/gi, "")
        .replace(/\s+/g, " ");
}

function findPlayerByIdentity(room, identityId) {
    return [...room.players.values()].find(
        player =>
            player.identityId === identityId
    );
}

function send(socket, message) {
    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    try {
        socket.send(
            JSON.stringify(message)
        );
    } catch (_) {}
}

function sendError(socket, message) {
    send(socket, {
        type: "error",
        message
    });
}

function sendErrorToRoom(room, message) {
    for (const player of room.players.values()) {
        for (const socket of player.connections) {
            sendError(socket, message);
        }
    }
}

function getPlayerName(room, playerId) {
    return (
        room.players.get(playerId)?.name ||
        "Spieler"
    );
}

function publicRoom(
    room,
    viewerPlayerId
) {
    const players = [
        ...room.players.values()
    ].map(player => ({
        id: player.id,
        name: player.name,
        owner: player.owner,
        connected:
            player.connections.size > 0,
        score: player.score,
        roundPoints:
            player.roundPoints
    }));

    const viewer =
        room.players.get(
            viewerPlayerId
        );

    return {
        code: room.code,

        ownerId:
            room.ownerId,

        isOwner:
            !!viewer &&
            viewer.id === room.ownerId,

        myPlayerId:
            viewerPlayerId || null,

        players,

        phase:
            room.phase,

        round:
            room.round,

        totalRounds:
            room.totalRounds,

        nennen: room.nennen
            ? {
                  round:
                      room.nennen.round,

                  totalRounds:
                      room.nennen
                          .totalRounds,

                  title:
                      room.nennen.title,

                  description:
                      room.nennen
                          .description,

                  currentPlayerId:
                      room.nennen
                          .currentPlayerId,

                  usedAnswers: [
                      ...room.nennen
                          .usedAnswers
                  ],

                  turnEndsAt:
                      room.nennen
                          .turnEndsAt
              }
            : null,

        quiz: room.quiz
            ? {
                  round:
                      room.quiz.round,

                  totalRounds:
                      room.quiz
                          .totalRounds,

                  number:
                      room.quiz.number,

                  totalQuestions:
                      room.quiz
                          .totalQuestions,

                  question:
                      room.quiz.question,

                  answers:
                      room.quiz.answers,

                  currentPlayerId:
                      room.quiz
                          .currentPlayerId,

                  answered:
                      room.quiz.answered
              }
            : null,

        estimate: room.estimate
            ? {
                  round:
                      room.estimate
                          .round,

                  totalRounds:
                      room.estimate
                          .totalRounds,

                  number:
                      room.estimate.number,

                  totalQuestions:
                      room.estimate
                          .totalQuestions,

                  question:
                      room.estimate.question,

                  currentPlayerId:
                      room.estimate
                          .currentPlayerId,

                  answered:
                      room.estimate
                          .answered
              }
            : null,

        results: room.results
            ? {
                  category:
                      room.results
                          .category,

                  message:
                      room.results
                          .message,

                  players:
                      room.results
                          .players
              }
            : null
    };
}

function broadcastRoom(room) {
    for (const player of room.players.values()) {
        const data = {
            type: "state",
            state: publicRoom(
                room,
                player.id
            )
        };

        for (const socket of player.connections) {
            send(socket, data);
        }
    }
}

function broadcastOnlineCount() {
    const count = clients.size;

    for (const socket of clients) {
        send(socket, {
            type: "onlineCount",
            count
        });
    }
}

function getActivePlayers(room) {
    return [
        ...room.players.values()
    ].filter(
        player => !player.owner
    );
}

function getConnectedActivePlayers(room) {
    return getActivePlayers(
        room
    ).filter(
        player =>
            player.connections.size > 0
    );
}

function nextActivePlayer(
    room,
    currentPlayerId
) {
    const players =
        getConnectedActivePlayers(
            room
        );

    if (!players.length) {
        return null;
    }

    const index =
        players.findIndex(
            player =>
                player.id ===
                currentPlayerId
        );

    if (index === -1) {
        return players[0];
    }

    return players[
        (index + 1) % players.length
    ];
}

function clearNennenTimer(room) {
    if (room.nennenTimer) {
        clearTimeout(
            room.nennenTimer
        );

        room.nennenTimer = null;
    }
}

function startNennen(room) {
    const players =
        getConnectedActivePlayers(
            room
        );

    if (players.length < 2) {
        sendErrorToRoom(
            room,
            "Mindestens 2 verbundene Mitspieler werden benötigt."
        );

        return false;
    }

    clearNennenTimer(room);

    const roundIndex =
        (room.round - 1) %
        NENNEN_ROUNDS.length;

    const topic =
        NENNEN_ROUNDS[
            roundIndex
        ];

    room.phase =
        "nennen";

    room.nennen = {
        round:
            room.round,

        totalRounds:
            room.totalRounds,

        title:
            topic.title,

        description:
            topic.description,

        answers:
            topic.answers,

        normalizedAnswers:
            new Map(
                topic.answers.map(
                    answer => [
                        normalizeAnswer(
                            answer
                        ),
                        answer
                    ]
                )
            ),

        usedAnswers:
            new Set(),

        currentPlayerId:
            players[0].id,

        turnEndsAt:
            Date.now() + 30000
    };

    room.results = null;

    broadcastRoom(room);

    scheduleNennenTimeout(
        room
    );

    return true;
}

function scheduleNennenTimeout(room) {
    clearNennenTimer(room);

    if (!room.nennen) {
        return;
    }

    const roomCode =
        room.code;

    const expectedPlayer =
        room.nennen
            .currentPlayerId;

    const expectedEnd =
        room.nennen
            .turnEndsAt;

    room.nennenTimer =
        setTimeout(() => {
            const currentRoom =
                rooms.get(
                    roomCode
                );

            if (
                !currentRoom ||
                currentRoom.phase !==
                    "nennen"
            ) {
                return;
            }

            if (
                !currentRoom.nennen
            ) {
                return;
            }

            if (
                currentRoom.nennen
                    .currentPlayerId !==
                    expectedPlayer ||
                currentRoom.nennen
                    .turnEndsAt !==
                    expectedEnd
            ) {
                return;
            }

            endNennenRound(
                currentRoom,
                `${getPlayerName(
                    currentRoom,
                    expectedPlayer
                )} hat die Zeit überschritten.`
            );
        }, 30100);
}

function endNennenRound(
    room,
    message
) {
    if (
        room.phase !==
        "nennen"
    ) {
        return;
    }

    clearNennenTimer(room);

    room.results = {
        category:
            "nennen",

        message,

        players:
            getActivePlayers(room)
                .map(player => ({
                    id:
                        player.id,

                    name:
                        player.name,

                    points:
                        player.roundPoints,

                    score:
                        player.score
                }))
                .sort(
                    (a, b) =>
                        b.points -
                        a.points
                )
    };

    room.phase =
        "results";

    broadcastRoom(room);
}

function startQuiz(room) {
    const players =
        getConnectedActivePlayers(
            room
        );

    if (players.length < 2) {
        sendErrorToRoom(
            room,
            "Mindestens 2 verbundene Mitspieler werden benötigt."
        );

        return false;
    }

    const questions =
        shuffle(
            QUIZ_QUESTIONS
        ).slice(
            0,
            Math.min(
                5,
                QUIZ_QUESTIONS.length
            )
        );

    room.quizQuestions =
        questions;

    room.quiz = {
        round:
            room.round,

        totalRounds:
            room.totalRounds,

        number:
            1,

        totalQuestions:
            questions.length,

        question:
            questions[0].question,

        answers:
            questions[0].answers,

        correct:
            questions[0].correct,

        currentPlayerId:
            players[0].id,

        answered:
            false
    };

    room.phase =
        "quiz";

    room.results =
        null;

    broadcastRoom(room);

    return true;
}

function nextQuizQuestion(room) {
    if (!room.quiz) {
        return;
    }

    const players =
        getConnectedActivePlayers(
            room
        );

    if (!players.length) {
        finishQuiz(room);
        return;
    }

    const number =
        room.quiz.number + 1;

    if (
        number >
        room.quizQuestions.length
    ) {
        finishQuiz(room);
        return;
    }

    const question =
        room.quizQuestions[
            number - 1
        ];

    room.quiz.number =
        number;

    room.quiz.question =
        question.question;

    room.quiz.answers =
        question.answers;

    room.quiz.correct =
        question.correct;

    room.quiz.currentPlayerId =
        players[
            (number - 1) %
                players.length
        ].id;

    room.quiz.answered =
        false;

    broadcastRoom(room);
}

function finishQuiz(room) {
    room.results = {
        category:
            "quiz",

        message:
            "Die Quizrunde ist beendet.",

        players:
            getActivePlayers(room)
                .map(player => ({
                    id:
                        player.id,

                    name:
                        player.name,

                    points:
                        player.roundPoints,

                    score:
                        player.score
                }))
                .sort(
                    (a, b) =>
                        b.points -
                        a.points
                )
    };

    room.phase =
        "results";

    broadcastRoom(room);
}

function startEstimate(room) {
    const players =
        getConnectedActivePlayers(
            room
        );

    if (players.length < 2) {
        sendErrorToRoom(
            room,
            "Mindestens 2 verbundene Mitspieler werden benötigt."
        );

        return false;
    }

    const questions =
        shuffle(
            ESTIMATE_QUESTIONS
        ).slice(
            0,
            Math.min(
                5,
                ESTIMATE_QUESTIONS.length
            )
        );

    room.estimateQuestions =
        questions;

    room.estimate = {
        round:
            room.round,

        totalRounds:
            room.totalRounds,

        number:
            1,

        totalQuestions:
            questions.length,

        question:
            questions[0].question,

        answer:
            questions[0].answer,

        currentPlayerId:
            players[0].id,

        answered:
            false
    };

    room.phase =
        "estimate";

    room.results =
        null;

    broadcastRoom(room);

    return true;
}

function nextEstimateQuestion(
    room
) {
    if (!room.estimate) {
        return;
    }

    const players =
        getConnectedActivePlayers(
            room
        );

    if (!players.length) {
        finishEstimate(room);
        return;
    }

    const number =
        room.estimate.number + 1;

    if (
        number >
        room.estimateQuestions.length
    ) {
        finishEstimate(room);
        return;
    }

    const question =
        room.estimateQuestions[
            number - 1
        ];

    room.estimate.number =
        number;

    room.estimate.question =
        question.question;

    room.estimate.answer =
        question.answer;

    room.estimate.currentPlayerId =
        players[
            (number - 1) %
                players.length
        ].id;

    room.estimate.answered =
        false;

    broadcastRoom(room);
}

function finishEstimate(room) {
    room.results = {
        category:
            "estimate",

        message:
            "Die Schätzrunde ist beendet.",

        players:
            getActivePlayers(room)
                .map(player => ({
                    id:
                        player.id,

                    name:
                        player.name,

                    points:
                        player.roundPoints,

                    score:
                        player.score
                }))
                .sort(
                    (a, b) =>
                        b.points -
                        a.points
                )
    };

    room.phase =
        "results";

    broadcastRoom(room);
}

function startCategory(
    room,
    category
) {
    if (
        category ===
        "nennen"
    ) {
        return startNennen(
            room
        );
    }

    if (
        category ===
        "quiz"
    ) {
        return startQuiz(
            room
        );
    }

    if (
        category ===
        "estimate"
    ) {
        return startEstimate(
            room
        );
    }

    return false;
}

function createRoom(
    player,
    socket
) {
    const code =
        makeRoomCode();

    const room = {
        code,

        ownerId:
            player.id,

        players:
            new Map(),

        phase:
            "lobby",

        round:
            1,

        totalRounds:
            3,

        nennen:
            null,

        nennenTimer:
            null,

        quiz:
            null,

        quizQuestions:
            [],

        estimate:
            null,

        estimateQuestions:
            [],

        results:
            null
    };

    player.owner =
        true;

    player.score =
        0;

    player.roundPoints =
        0;

    player.roomCode =
        code;

    room.players.set(
        player.id,
        player
    );

    rooms.set(
        code,
        room
    );

    send(socket, {
        type:
            "roomCreated",

        code
    });

    broadcastRoom(room);
}

function joinRoom(
    player,
    socket,
    code
) {
    const room =
        rooms.get(code);

    if (!room) {
        sendError(
            socket,
            "Dieser Raum existiert nicht."
        );

        return;
    }

    if (
        room.phase !==
        "lobby"
    ) {
        sendError(
            socket,
            "Dieses Spiel wurde bereits gestartet."
        );

        return;
    }

    const existing =
        findPlayerByIdentity(
            room,
            player.identityId
        );

    if (existing) {
        existing.name =
            player.name ||
            existing.name;

        socket.player =
            existing;

        socket.roomCode =
            room.code;

        existing.connections.add(
            socket
        );

        send(socket, {
            type:
                "joinedRoom",

            code:
                room.code
        });

        broadcastRoom(room);

        broadcastOnlineCount();

        return;
    }

    if (player.roomCode) {
        if (
            player.roomCode ===
            code
        ) {
            const currentRoom =
                rooms.get(
                    player.roomCode
                );

            if (currentRoom) {
                player.connections.add(
                    socket
                );

                socket.player =
                    player;

                socket.roomCode =
                    player.roomCode;

                send(socket, {
                    type:
                        "joinedRoom",

                    code:
                        currentRoom.code
                });

                broadcastRoom(
                    currentRoom
                );

                return;
            }
        }

        sendError(
            socket,
            "Du bist bereits in einem anderen Raum."
        );

        return;
    }

    if (
        room.players.size >=
        16
    ) {
        sendError(
            socket,
            "Der Raum ist voll."
        );

        return;
    }

    player.roomCode =
        room.code;

    player.owner =
        false;

    player.score =
        0;

    player.roundPoints =
        0;

    room.players.set(
        player.id,
        player
    );

    socket.player =
        player;

    player.connections.add(
        socket
    );

    socket.roomCode =
        room.code;

    send(socket, {
        type:
            "joinedRoom",

        code:
            room.code
    });

    broadcastRoom(room);
}

function attachSocketToPlayer(
    player,
    socket
) {
    socket.player =
        player;

    socket.roomCode =
        player.roomCode ||
        null;

    player.connections.add(
        socket
    );

    clients.add(socket);

    send(socket, {
        type:
            "identified",

        playerId:
            player.id
    });

    if (player.roomCode) {
        const room =
            rooms.get(
                player.roomCode
            );

        if (room) {
            send(socket, {
                type:
                    "state",

                state:
                    publicRoom(
                        room,
                        player.id
                    )
            });
        }
    }

    broadcastOnlineCount();
}

function removeSocket(
    socket
) {
    clients.delete(socket);

    const player =
        socket.player;

    if (!player) {
        broadcastOnlineCount();
        return;
    }

    player.connections.delete(
        socket
    );

    broadcastOnlineCount();

    if (player.roomCode) {
        const room =
            rooms.get(
                player.roomCode
            );

        if (room) {
            broadcastRoom(room);
        }
    }
}

function leaveRoom(socket) {
    const player =
        socket.player;

    if (
        !player ||
        !player.roomCode
    ) {
        send(socket, {
            type:
                "leftRoom"
        });

        return;
    }

    const room =
        rooms.get(
            player.roomCode
        );

    if (!room) {
        player.roomCode =
            null;

        send(socket, {
            type:
                "leftRoom"
        });

        return;
    }

    if (player.owner) {
        clearNennenTimer(room);

        for (
            const other of
            room.players.values()
        ) {
            other.roomCode =
                null;

            for (
                const otherSocket of
                other.connections
            ) {
                send(
                    otherSocket,
                    {
                        type:
                            "leftRoom"
                    }
                );
            }
        }

        rooms.delete(
            room.code
        );

        broadcastOnlineCount();

        return;
    }

    room.players.delete(
        player.id
    );

    player.roomCode =
        null;

    player.connections.clear();

    send(socket, {
        type:
            "leftRoom"
    });

    if (
        room.players.size ===
        0
    ) {
        clearNennenTimer(room);

        rooms.delete(
            room.code
        );
    } else {
        broadcastRoom(room);
    }
}

function handleMessage(
    socket,
    message
) {
    let data;

    try {
        data = JSON.parse(
            message.toString()
        );
    } catch {
        sendError(
            socket,
            "Ungültige Nachricht."
        );

        return;
    }

    if (
        data.type ===
        "identify"
    ) {
        const identityId =
            String(
                data.identityId ||
                    ""
            )
                .trim()
                .slice(0, 200);

        if (!identityId) {
            sendError(
                socket,
                "Keine Browser-ID vorhanden."
            );

            return;
        }

        let player =
            null;

        for (
            const room of
            rooms.values()
        ) {
            const found =
                findPlayerByIdentity(
                    room,
                    identityId
                );

            if (found) {
                player =
                    found;

                break;
            }
        }

        if (!player) {
            player = {
                id:
                    makePlayerId(),

                identityId,

                name:
                    "",

                owner:
                    false,

                roomCode:
                    null,

                score:
                    0,

                roundPoints:
                    0,

                connections:
                    new Set()
            };
        }

        attachSocketToPlayer(
            player,
            socket
        );

        return;
    }

    if (!socket.player) {
        sendError(
            socket,
            "Verbindung wurde noch nicht identifiziert."
        );

        return;
    }

    const player =
        socket.player;

    if (
        data.type ===
        "createRoom"
    ) {
        const name =
            cleanName(
                data.name
            );

        if (!name) {
            sendError(
                socket,
                "Bitte gib einen Namen ein."
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

        player.name =
            name;

        createRoom(
            player,
            socket
        );

        return;
    }

    if (
        data.type ===
        "joinRoom"
    ) {
        const name =
            cleanName(
                data.name
            );

        const code =
            String(
                data.code || ""
            )
                .trim()
                .toUpperCase();

        if (!name) {
            sendError(
                socket,
                "Bitte gib einen Namen ein."
            );

            return;
        }

        if (
            !/^[A-Z0-9]{5}$/.test(
                code
            )
        ) {
            sendError(
                socket,
                "Der Raumcode muss 5 Zeichen haben."
            );

            return;
        }

        player.name =
            name;

        if (
            player.roomCode
        ) {
            if (
                player.roomCode ===
                code
            ) {
                const room =
                    rooms.get(
                        code
                    );

                if (room) {
                    const existing =
                        findPlayerByIdentity(
                            room,
                            player.identityId
                        );

                    if (existing) {
                        existing.name =
                            name;

                        socket.player =
                            existing;

                        socket.roomCode =
                            room.code;

                        existing.connections.add(
                            socket
                        );

                        send(socket, {
                            type:
                                "joinedRoom",

                            code:
                                room.code
                        });

                        broadcastRoom(
                            room
                        );

                        return;
                    }
                }
            } else {
                sendError(
                    socket,
                    "Du bist bereits in einem anderen Raum."
                );

                return;
            }
        }

        joinRoom(
            player,
            socket,
            code
        );

        return;
    }

    if (
        data.type ===
        "startGame"
    ) {
        const room =
            rooms.get(
                player.roomCode
            );

        if (!room) {
            sendError(
                socket,
                "Raum nicht gefunden."
            );

            return;
        }

        if (
            room.ownerId !==
            player.id
        ) {
            sendError(
                socket,
                "Nur der Besitzer kann das Spiel starten."
            );

            return;
        }

        if (
            getActivePlayers(
                room
            ).length < 2
        ) {
            sendError(
                socket,
                "Mindestens 2 Mitspieler werden benötigt."
            );

            return;
        }

        room.phase =
            "category";

        room.round =
            1;

        room.results =
            null;

        for (
            const p of
            room.players.values()
        ) {
            p.score =
                0;

            p.roundPoints =
                0;
        }

        broadcastRoom(room);

        return;
    }

    if (
        data.type ===
        "chooseCategory"
    ) {
        const room =
            rooms.get(
                player.roomCode
            );

        if (!room) {
            sendError(
                socket,
                "Raum nicht gefunden."
            );

            return;
        }

        if (
            room.ownerId !==
            player.id
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
            sendError(
                socket,
                "Jetzt kann keine Kategorie gewählt werden."
            );

            return;
        }

        const category =
            String(
                data.category ||
                    ""
            );

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

        startCategory(
            room,
            category
        );

        return;
    }

    if (
        data.type ===
        "nennenAnswer"
    ) {
        const room =
            rooms.get(
                player.roomCode
            );

        if (
            !room ||
            room.phase !==
                "nennen" ||
            !room.nennen
        ) {
            return;
        }

        if (
            room.nennen
                .currentPlayerId !==
            player.id
        ) {
            sendError(
                socket,
                "Du bist gerade nicht an der Reihe."
            );

            return;
        }

        if (
            Date.now() >
            room.nennen.turnEndsAt
        ) {
            endNennenRound(
                room,
                `${player.name} hat die Zeit überschritten.`
            );

            return;
        }

        const answer =
            String(
                data.answer ||
                    ""
            ).trim();

        if (!answer) {
            sendError(
                socket,
                "Bitte gib eine Antwort ein."
            );

            return;
        }

        const normalized =
            normalizeAnswer(
                answer
            );

        if (
            room.nennen
                .usedAnswers.has(
                    normalized
                )
        ) {
            endNennenRound(
                room,
                `${player.name} hat eine Antwort wiederholt.`
            );

            return;
        }

        const valid =
            room.nennen
                .normalizedAnswers
                .has(normalized);

        if (!valid) {
            endNennenRound(
                room,
                `"${answer}" ist keine gültige Antwort.`
            );

            return;
        }

        room.nennen.usedAnswers.add(
            normalized
        );

        player.roundPoints +=
            1;

        const next =
            nextActivePlayer(
                room,
                player.id
            );

        if (!next) {
            endNennenRound(
                room,
                "Keine weiteren Mitspieler."
            );

            return;
        }

        room.nennen
            .currentPlayerId =
            next.id;

        room.nennen.turnEndsAt =
            Date.now() + 30000;

        broadcastRoom(room);

        scheduleNennenTimeout(
            room
        );

        return;
    }

    if (
        data.type ===
        "quizAnswer"
    ) {
        const room =
            rooms.get(
                player.roomCode
            );

        if (
            !room ||
            room.phase !==
                "quiz" ||
            !room.quiz
        ) {
            return;
        }

        if (
            room.quiz
                .currentPlayerId !==
            player.id
        ) {
            sendError(
                socket,
                "Du bist gerade nicht an der Reihe."
            );

            return;
        }

        if (
            room.quiz.answered
        ) {
            return;
        }

        const index =
            Number(
                data.index
            );

        if (
            !Number.isInteger(
                index
            ) ||
            index < 0 ||
            index >=
                room.quiz.answers
                    .length
        ) {
            sendError(
                socket,
                "Ungültige Antwort."
            );

            return;
        }

        room.quiz.answered =
            true;

        if (
            index ===
            room.quiz.correct
        ) {
            player.roundPoints +=
                1;
        }

        broadcastRoom(room);

        setTimeout(() => {
            const currentRoom =
                rooms.get(
                    room.code
                );

            if (
                currentRoom &&
                currentRoom.phase ===
                    "quiz" &&
                currentRoom.quiz &&
                currentRoom.quiz.answered
            ) {
                nextQuizQuestion(
                    currentRoom
                );
            }
        }, 1000);

        return;
    }

    if (
        data.type ===
        "estimateAnswer"
    ) {
        const room =
            rooms.get(
                player.roomCode
            );

        if (
            !room ||
            room.phase !==
                "estimate" ||
            !room.estimate
        ) {
            return;
        }

        if (
            room.estimate
                .currentPlayerId !==
            player.id
        ) {
            sendError(
                socket,
                "Du bist gerade nicht an der Reihe."
            );

            return;
        }

        if (
            room.estimate
                .answered
        ) {
            return;
        }

        const value =
            Number(
                String(
                    data.answer ||
                        ""
                ).replace(
                    ",",
                    "."
                )
            );

        if (
            !Number.isFinite(
                value
            )
        ) {
            sendError(
                socket,
                "Bitte gib eine Zahl ein."
            );

            return;
        }

        room.estimate
            .answered =
            true;

        const correct =
            room.estimate.answer;

        const distance =
            Math.abs(
                value - correct
            );

        let points =
            0;

        if (
            distance === 0
        ) {
            points = 3;
        } else if (
            distance <=
            Math.max(
                1,
                correct * 0.05
            )
        ) {
            points = 2;
        } else if (
            distance <=
            Math.max(
                2,
                correct * 0.15
            )
        ) {
            points = 1;
        }

        player.roundPoints +=
            points;

        broadcastRoom(room);

        setTimeout(() => {
            const currentRoom =
                rooms.get(
                    room.code
                );

            if (
                currentRoom &&
                currentRoom.phase ===
                    "estimate" &&
                currentRoom.estimate &&
                currentRoom.estimate.answered
            ) {
                nextEstimateQuestion(
                    currentRoom
                );
            }
        }, 1000);

        return;
    }

    if (
        data.type ===
        "continueRound"
    ) {
        const room =
            rooms.get(
                player.roomCode
            );

        if (!room) {
            return;
        }

        if (
            room.ownerId !==
            player.id
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

        for (
            const p of
            getActivePlayers(room)
        ) {
            p.score +=
                p.roundPoints;

            p.roundPoints =
                0;
        }

        if (
            room.round >=
            room.totalRounds
        ) {
            room.phase =
                "final";

            broadcastRoom(room);

            return;
        }

        room.round +=
            1;

        room.phase =
            "category";

        room.nennen =
            null;

        room.quiz =
            null;

        room.estimate =
            null;

        room.results =
            null;

        broadcastRoom(room);

        return;
    }

    if (
        data.type ===
        "leaveRoom"
    ) {
        leaveRoom(socket);
        return;
    }
}

const server =
    http.createServer(
        (req, res) => {
            let requested;

            try {
                requested =
                    decodeURIComponent(
                        String(
                            req.url ||
                                "/"
                        ).split(
                            "?"
                        )[0]
                    );
            } catch {
                res.writeHead(
                    400
                );

                res.end(
                    "Bad Request"
                );

                return;
            }

            if (
                requested ===
                "/"
            ) {
                requested =
                    "/index.html";
            }

            requested =
                requested.replace(
                    /^[/\\]+/,
                    ""
                );

            const filePath =
                path.resolve(
                    __dirname,
                    requested
                );

            const rootPath =
                path.resolve(
                    __dirname
                );

            if (
                filePath !==
                    rootPath &&
                !filePath.startsWith(
                    rootPath +
                        path.sep
                )
            ) {
                res.writeHead(
                    403
                );

                res.end(
                    "Forbidden"
                );

                return;
            }

            fs.readFile(
                filePath,
                (
                    error,
                    data
                ) => {
                    if (error) {
                        res.writeHead(
                            404,
                            {
                                "Content-Type":
                                    "text/plain; charset=utf-8"
                            }
                        );

                        res.end(
                            "404 - Datei nicht gefunden"
                        );

                        return;
                    }

                    const extension =
                        path
                            .extname(
                                filePath
                            )
                            .toLowerCase();

                    const contentTypes =
                        {
                            ".html":
                                "text/html; charset=utf-8",

                            ".css":
                                "text/css; charset=utf-8",

                            ".js":
                                "application/javascript; charset=utf-8",

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

                            ".ico":
                                "image/x-icon"
                        };

                    res.writeHead(
                        200,
                        {
                            "Content-Type":
                                contentTypes[
                                    extension
                                ] ||
                                "application/octet-stream",

                            "Cache-Control":
                                "no-store, no-cache, must-revalidate, proxy-revalidate",

                            Pragma:
                                "no-cache",

                            Expires:
                                "0"
                        }
                    );

                    res.end(
                        data
                    );
                }
            );
        }
    );

const wss =
    new WebSocket.Server({
        server
    });

wss.on(
    "connection",
    socket => {
        clients.add(socket);

        socket.on(
            "message",
            message => {
                handleMessage(
                    socket,
                    message
                );
            }
        );

        socket.on(
            "close",
            () => {
                removeSocket(
                    socket
                );
            }
        );

        socket.on(
            "error",
            () => {
                removeSocket(
                    socket
                );
            }
        );

        broadcastOnlineCount();
    }
);

server.listen(
    PORT,
    HOST,
    () => {
        console.log("");
        console.log(
            "=========================================="
        );
        console.log(
            "   MINECRAFT LAST MAN STANDING"
        );
        console.log(
            "=========================================="
        );
        console.log("");
        console.log(
            `Website: http://localhost:${PORT}`
        );
        console.log(
            `Server:  ws://localhost:${PORT}`
        );
        console.log("");
        console.log(
            "Server läuft."
        );
        console.log("");
    }
);