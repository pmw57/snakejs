/*jslint browser */
(function () {
    "use strict";
    var MIN_MAINLOOP_INTERVAL_TIME = 20;
    var MAX_MAINLOOP_INTERVAL_TIME = 120;
    var MIN_SPEED = 1;
    var MAX_SPEED = 20;
    // Constant used to derive time in milliseconds from a 1 to 20 speed value
    var K = (MAX_MAINLOOP_INTERVAL_TIME - MIN_MAINLOOP_INTERVAL_TIME) / MAX_SPEED;

    var DIRECTION = {
        UP: 0,
        DOWN: 1,
        LEFT: 2,
        RIGHT: 3
    };

    // Represents a x y position on the game field.
    //
    function makePosition(x, y) {
        var pos = {};

        function equals(other) {
            return pos.x === other.x && pos.y === other.y;
        }

        return Object.assign(pos, {
            equals: equals,
            x: x,
            y: y
        });
    }

    var OUT_OF_GAME_FIELD = makePosition(-1, -1);


    // Represents the canvas on which to draw elements. Should be initialized with
    // init method. It takes the whole size of document.body. Provides few methods
    // to draw / clear blocks.
    //
    var scene = {};
    scene = Object.assign(scene, {
        canvas: null,
        context: null,
        blockBorderSize: 0,

        // Initializes canvas and context. Optional background color and blocks
        // border size can be passed, default are #000000 and 0 respectively.
        //
        init: function (backgroundColor, blockBorderSize) {
            scene.canvas = document.getElementById("scene");
            scene.canvas.style.backgroundColor = backgroundColor || "#000000";
            scene.canvas.width = document.body.clientWidth;
            scene.canvas.height = document.body.clientHeight;
            scene.context = scene.canvas.getContext("2d");
            scene.blockBorderSize = blockBorderSize || 0;
        },

        // Draws a block on the scene. It scales x and y by size.
        //
        drawBlock: function (position, size, color) {
            scene.context.fillStyle = color;
            scene.context.fillRect(
                position.x * size,
                position.y * size,
                size - scene.blockBorderSize,
                size - scene.blockBorderSize
            );
        },

        // Clears a block from the scene.
        //
        clearBlock: function (position, size) {
            scene.context.clearRect(
                position.x * size,
                position.y * size,
                size - scene.blockBorderSize,
                size - scene.blockBorderSize
            );
        },

        // Clears the entire scene.
        //
        clear: function () {
            scene.context.clearRect(0, 0, scene.canvas.width, scene.canvas.height);
        }
    });


    // Special block that can be eaten by the snake. Takes an options object which
    // is used to initialize its properties. In particular:
    //
    // game: game object on which spawn / remove and perform action;
    //
    // action: function that should be invoked when the food has been eaten, it
    //         should modify the state of the game (e.g. score, speed...);
    //
    // spawnIn: max time in seconds within which the food should be spawned on the
    //          game field at a random position;
    //
    // removeIn: max time in seconds within which the food should be removed from
    //           the game field if it has not been eaten yet.
    //
    function Food(options) {
        var food = {};

        return Object.assign(food, {
            game: options.game,
            color: options.color,
            action: options.action,
            spawnIn: options.spawnIn,
            removeIn: options.removeIn,
            position: OUT_OF_GAME_FIELD,
            removeTimeout: null,
            spawnTimeout: null,
            drawFood: function () {
                food.game.scene.drawBlock(food.position, food.game.blockSize, food.color);
            },
            clearFood: function () {
                food.game.scene.clearBlock(food.position, food.game.blockSize);
            },

            // Clears the eventual removeTimeout and current food position. Sets
            // spawnTimeout for the food to be spawned at a random position within 0 and
            // spawnIn seconds. It then calls remove to schedule its removal within 0 and
            // removeIn seconds if it will not be eaten.
            //
            scheduleSpawn: function () {
                clearTimeout(food.removeTimeout);
                food.position = OUT_OF_GAME_FIELD;

                var time = Math.floor(Math.random() * food.spawnIn * 1000);
                var that = food;
                food.spawnTimeout = setTimeout(function () {
                    that.position = that.game.getRandomFreePosition();
                    that.drawFood();
                    that.scheduleRemove();
                }, time);
            },

            // Schedules the removal of the food within 0 and removeIn seconds if it will
            // not be eaten. It then calls spawnFood to schedule its respawn within 0 and
            // spawnIn seconds.
            //
            scheduleRemove: function () {
                var time = Math.floor(Math.random() * food.removeIn * 1000);
                var that = food;
                food.removeTimeout = setTimeout(function () {
                    that.clearFood();
                    that.position = OUT_OF_GAME_FIELD;
                    that.scheduleSpawn();
                }, time);
            },

            // Clears: eventual scheduled spawn and delete; food on the game field; food
            // position.
            //
            // Should be called in a game over situation to avoid that food will continue
            // to spawn.
            //
            delete: function () {
                clearTimeout(food.spawnTimeout);
                clearTimeout(food.removeTimeout);
                food.clearFood();
                food.position = OUT_OF_GAME_FIELD;
            }
        });
    }


    // Holds the game status and methods to play. Should be initialized with init
    // method, it can then be (re)started with start method. Restarts should be
    // preceded by a gameOver call.
    //
    var game = {};
    game = Object.assign({
        mainLoopInterval: null,
        updateElapsedTimeInterval: null,

        scene: null,
        blockSize: 35, // size of blocks in pixels
        width: 0, // max x position on game field
        height: 0, // max y position on game field

        playing: false,
        elapsedTime: 0, // time in seconds since start
        direction: DIRECTION.DOWN, // current direction
        nextDirections: [], // queue of directions, needed because the player could type really fast
        speed: 1, // should be changed using adjustSpeed method
        score: 0,
        body: [], // body of the snake i.e. an array of positions
        foods: [], // foods that appears on the game field

        init: function () {
            game.scene = scene;
            game.scene.init("#4F4F4F", 2);
            game.width = Math.round(game.scene.canvas.width / game.blockSize);
            game.height = Math.round(game.scene.canvas.height / game.blockSize);

            document.addEventListener("keydown", game.handleKey.bind(game));

            game.foods.push(
                new Food({
                    game: game,
                    color: "yellow",
                    spawnIn: 10,
                    removeIn: 30,
                    action: function () {
                        game.game.increaseScore(1);
                        game.game.resizeBody(game.game.body.length + 3);
                        game.game.adjustSpeed(game.game.speed + 1);
                    }
                }),
                new Food({
                    game: game,
                    color: "red",
                    spawnIn: 30,
                    removeIn: 15,
                    action: function () {
                        game.game.increaseScore(game.game.body.length * 2);
                        game.game.resizeBody(game.game.body.length * 2);
                        game.game.adjustSpeed(game.game.speed + 1);
                    }
                }),
                new Food({
                    game: game,
                    color: "blue",
                    spawnIn: 30,
                    removeIn: 15,
                    action: function () {
                        game.game.increaseScore(game.game.body.length * 2);
                        game.game.resizeBody(game.game.body.length / 2);
                    }
                }),
                new Food({
                    game: game,
                    color: "purple",
                    spawnIn: 180,
                    removeIn: 10,
                    action: function () {
                        game.game.increaseScore(game.game.score);
                        game.game.resizeBody(1);
                        game.game.adjustSpeed(1);
                    }
                }),
                new Food({
                    game: game,
                    color: "black",
                    spawnIn: 120,
                    removeIn: 30,
                    action: function () {
                        game.game.gameOver();
                    }
                })
            );

            game.updateMessage("Press N to start");
        },

        // Resets game status and starts a new game.
        //
        start: function () {
            game.scene.clear();
            game.playing = true;
            game.elapsedTime = 0;
            game.direction = DIRECTION.DOWN;
            game.nextDirections.length = 0;
            game.adjustSpeed(1);
            game.score = 0;
            game.body.length = 0;

            game.foods.forEach(function (food) {
                food.scheduleSpawn();
            });

            game.body.push(game.getRandomFreePosition());
            game.drawHead();

            game.updateInfos();
            game.updateMessage("");
            game.updateElapsedTimeInterval = setInterval(game.updateElapsedTime.bind(game, 1), 1000);
        },

        // Callback for "keydown" events.
        //
        handleKey: function (event) {
            switch (event.key) {
            case "w":
            case "k":
            case "ArrowUp":
                game.pushDirection(DIRECTION.UP);
                break;
            case "s":
            case "j":
            case "ArrowDown":
                game.pushDirection(DIRECTION.DOWN);
                break;
            case "a":
            case "h":
            case "ArrowLeft":
                game.pushDirection(DIRECTION.LEFT);
                break;
            case "d":
            case "l":
            case "ArrowRight":
                game.pushDirection(DIRECTION.RIGHT);
                break;
            case "n":
                if (!game.playing) {
                    game.start();
                }
                break;
            }
        },

        // Pushes dir inside nextDirections queue if it's not in conflict with
        // the last direction.
        //
        pushDirection: function (dir) {
            var lastDir = (game.nextDirections.length > 0)
                ? game.nextDirections[game.nextDirections.length - 1]
                : game.direction;
            switch (dir) {
            case DIRECTION.UP:
            case DIRECTION.DOWN:
                if (lastDir !== DIRECTION.UP && lastDir !== DIRECTION.DOWN) {
                    game.nextDirections.push(dir);
                }
                break;
            case DIRECTION.LEFT:
            case DIRECTION.RIGHT:
                if (lastDir !== DIRECTION.LEFT && lastDir !== DIRECTION.RIGHT) {
                    game.nextDirections.push(dir);
                }
                break;
            }
        },

        // Moves the snake by one position towards the current direction.
        // If nextDirections queue isn't empty, a direction is dequeued and it
        // will become the new current direction before performing the moving.
        //
        move: function () {
            if (game.nextDirections.length > 0) {
                game.direction = game.nextDirections.shift();
            }

            var head = game.body[0];
            var tail = game.body.pop();
            tail.x = head.x;
            tail.y = head.y;
            game.body.unshift(tail);
            head = tail;

            switch (game.direction) {
            case DIRECTION.UP:
                head.y -= 1;
                if (head.y < 0) {
                    head.y = game.height - 1;
                }
                break;
            case DIRECTION.DOWN:
                head.y += 1;
                if (head.y > game.height - 1) {
                    head.y = 0;
                }
                break;
            case DIRECTION.LEFT:
                head.x -= 1;
                if (head.x < 0) {
                    head.x = game.width - 1;
                }
                break;
            case DIRECTION.RIGHT:
                head.x += 1;
                if (head.x > game.width - 1) {
                    head.x = 0;
                }
                break;
            }
        },

        // Resizes the body adding or deleting the necessary blocks.
        // newLength should be >= 1. If it's less than 1, it will become 1.
        //
        resizeBody: function (newLength) {
            newLength = Math.floor((newLength < 1)
                ? 1
                : newLength);

            if (game.body.length < newLength) {
                var tail = game.body[game.body.length - 1];
                while (game.body.length < newLength) {
                    game.body.push(makePosition(tail.x, tail.y));
                }
            } else {
                while (game.body.length > newLength) {
                    game.clearTail();
                    game.body.pop();
                }
            }
        },

        // Return true if the body is currently growing i.e. if the tail
        // position is equal to the position that precedes it.
        //
        isGrowing: function () {
            var len = game.body.length;
            return len > 1 && game.body[len - 1].equals(game.body[len - 2]);
        },

        // Return the food object in position pos or null if there is no food in
        // position pos.
        //
        getFoodIn: function (pos) {
            return game.foods.find(function (food) {
                return food.position.equals(pos);
            });
        },


        // Return true if there is a food object in position pos, false
        // otherwise.
        //
        collideWithFoods: function (pos) {
            return game.getFoodIn(pos) || false;
        },

        // Return true if there is a body block in position pos, false
        // otherwise.
        // Takes an optional switch to ignore the head position.
        //
        collideWithBody: function (pos, ignoreHead) {
            return game.body.find(function (body, i) {
                if (i === 0 && ignoreHead) {
                    return false;
                }
                return body.equals(pos);
            });
        },

        // Return a new free position i.e. a position not already occupied by a
        // body block or food.
        //
        getRandomFreePosition: function () {
            var pos = makePosition(0, 0);
            do {
                pos.x = Math.floor(Math.random() * game.width);
                pos.y = Math.floor(Math.random() * game.height);
            } while (game.collideWithBody(pos) || game.collideWithFoods(pos));
            return pos;
        },

        // Changes the speed. This is realized by changing the interval time of
        // mainLoop, so game method can be used to (re)start the game.
        // speed should be between MIN_SPEED and MAX_SPEED, otherwise it will be
        // "forced" to those values.
        //
        adjustSpeed: function (speed) {
            if (speed < MIN_SPEED) {
                game.speed = MIN_SPEED;
            } else if (speed > MAX_SPEED) {
                game.speed = MAX_SPEED;
            } else {
                game.speed = Math.floor(speed);
            }
            var time = Math.floor(MAX_MAINLOOP_INTERVAL_TIME - K * game.speed);
            clearInterval(game.mainLoopInterval);
            game.mainLoopInterval = setInterval(game.mainLoop.bind(game), time);
        },

        increaseScore: function (increment) {
            game.score += Math.floor(game.speed * increment + game.body.length);
        },

        // Puts the game in a gameover situation stopping everything.
        //
        gameOver: function () {
            game.playing = false;
            clearInterval(game.mainLoopInterval);
            clearInterval(game.updateElapsedTimeInterval);
            game.foods.forEach(function (food) {
                food.delete();
            });
            game.updateMessage("GAME OVER! Press N to play again");
        },

        drawHead: function () {
            game.scene.drawBlock(game.body[0], game.blockSize, "green");
        },

        clearTail: function () {
            // if the snake is growing we should not clear the tail position
            // because there is at least another block in that position
            if (!game.isGrowing()) {
                game.scene.clearBlock(game.body[game.body.length - 1], game.blockSize);
            }
        },

        mainLoop: function () {
            game.clearTail();
            game.move();
            game.drawHead();

            var head = game.body[0];

            if (game.collideWithBody(head, true)) {
                game.gameOver();
                return;
            }

            var food = game.getFoodIn(head);
            if (food) {
                food.scheduleSpawn();
                food.action(); // executed after (re)spawn because action could be gameOver()
                game.updateInfos();
            }
        },

        // Updates elapsed time both on the page and in the game status. secs
        // should match the number of seconds setted in the interval which calls
        // this method.
        //
        updateElapsedTime: (function () {
            var elapsedTimeElm = document.getElementById("elapsedTime");
            return function (secs) {
                game.elapsedTime += secs;
                elapsedTimeElm.innerHTML = game.getElapsedTimeHMS();
            };
        }()),

        getElapsedTimeHMS: function () {
            var h = Math.floor(game.elapsedTime / 60 / 60);
            var m = Math.floor(game.elapsedTime / 60 % 60);
            var s = Math.floor(game.elapsedTime % 60);
            return (
                (h > 9)
                    ? ""
                    : "0"
            ) + h + ":" + (
                (m > 9)
                    ? ""
                    : "0"
            ) + m + ":" + (
                (s > 9)
                    ? ""
                    : "0"
            ) + s;
        },

        updateInfos: (function () {
            var lengthElm = document.getElementById("length");
            var speedElm = document.getElementById("speed");
            var scoreElm = document.getElementById("score");
            return function () {
                lengthElm.innerHTML = game.body.length;
                speedElm.innerHTML = game.speed;
                scoreElm.innerHTML = game.score;
            };
        }()),

        updateMessage: (function () {
            var messageElm = document.getElementById("message");
            return function (msg) {
                messageElm.innerHTML = msg;
            };
        }())
    });


    game.init();
}());