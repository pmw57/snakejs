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

var OUT_OF_GAME_FIELD = new Position(-1, -1);


// Represents a x y position on the game field.
//
function Position(x, y)
{
        this.x = x;
        this.y = y;
}

Position.prototype.equals = function(other)
{
        return this.x === other.x && this.y === other.y;
};


// Represents the canvas on which to draw elements. Should be initialized with
// init method. It takes the whole size of document.body. Provides few methods
// to draw / clear blocks.
//
var scene = {
        canvas: null,
        context: null,
        blockBorderSize: 0,

        // Initializes canvas and context. Optional background color and blocks
        // border size can be passed, default are #000000 and 0 respectively.
        //
        init: function(backgroundColor, blockBorderSize)
        {
                this.canvas = document.getElementById("scene");
                this.canvas.style.backgroundColor = backgroundColor || "#000000";
                this.canvas.width = document.body.clientWidth;
                this.canvas.height = document.body.clientHeight;
                this.context = this.canvas.getContext("2d");
                this.blockBorderSize = blockBorderSize || 0;
        },

        // Draws a block on the scene. It scales x and y by size.
        //
        drawBlock: function(position, size, color)
        {
                this.context.fillStyle = color;
                this.context.fillRect(position.x * size, position.y * size,
                                      size - this.blockBorderSize, size - this.blockBorderSize);
        },

        // Clears a block from the scene.
        //
        clearBlock: function(position, size)
        {
                this.context.clearRect(position.x * size, position.y * size,
                                       size - this.blockBorderSize, size - this.blockBorderSize);
        },

        // Clears the entire scene.
        //
        clear: function()
        {
                this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
};


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
function Food(options)
{
        this.game = options.game;
        this.color = options.color;
        this.action = options.action;
        this.spawnIn = options.spawnIn;
        this.removeIn = options.removeIn;
        this.position = OUT_OF_GAME_FIELD;
        this.removeTimeout = null;
        this.spawnTimeout = null;
}

Food.prototype.drawFood = function()
{
        this.game.scene.drawBlock(this.position, this.game.blockSize, this.color);
};

Food.prototype.clearFood = function()
{
        this.game.scene.clearBlock(this.position, this.game.blockSize);
};

// Clears the eventual removeTimeout and current food position. Sets
// spawnTimeout for the food to be spawned at a random position within 0 and
// spawnIn seconds. It then calls remove to schedule its removal within 0 and
// removeIn seconds if it will not be eaten.
//
Food.prototype.scheduleSpawn = function()
{
        clearTimeout(this.removeTimeout);
        this.position = OUT_OF_GAME_FIELD;

        var time = Math.floor(Math.random() * this.spawnIn * 1000);
        var that = this;
        this.spawnTimeout = setTimeout(function()
        {
                that.position = that.game.getRandomFreePosition();
                that.drawFood();
                that.scheduleRemove();
        }, time);
};

// Schedules the removal of the food within 0 and removeIn seconds if it will
// not be eaten. It then calls spawnFood to schedule its respawn within 0 and
// spawnIn seconds.
//
Food.prototype.scheduleRemove = function()
{
        var time = Math.floor(Math.random() * this.removeIn * 1000);
        var that = this;
        this.removeTimeout = setTimeout(function()
        {
                that.clearFood();
                that.position = OUT_OF_GAME_FIELD;
                that.scheduleSpawn();
        }, time);
};

// Clears: eventual scheduled spawn and delete; food on the game field; food
// position.
//
// Should be called in a game over situation to avoid that food will continue
// to spawn.
//
Food.prototype.delete = function()
{
        clearTimeout(this.spawnTimeout);
        clearTimeout(this.removeTimeout);
        this.clearFood();
        this.position = OUT_OF_GAME_FIELD;
};


// Holds the game status and methods to play. Should be initialized with init
// method, it can then be (re)started with start method. Restarts should be
// preceded by a gameOver call.
//
var game = {
        mainLoopInterval: null,
        updateElapsedTimeInterval: null,

        scene: null,
        blockSize: 35,                  // size of blocks in pixels
        width: 0,                       // max x position on game field
        height: 0,                      // max y position on game field

        playing: false,
        elapsedTime: 0,                 // time in seconds since start
        direction: DIRECTION.DOWN,      // current direction
        nextDirections: [],             // queue of directions, needed because the player could type really fast
        speed: 1,                       // should be changed using adjustSpeed method
        score: 0,
        body: [],                       // body of the snake i.e. an array of positions
        foods: [],                      // foods that appears on the game field

        init: function()
        {
                this.scene = scene;
                this.scene.init("#4F4F4F", 2);
                this.width = Math.round(this.scene.canvas.width / this.blockSize);
                this.height = Math.round(this.scene.canvas.height / this.blockSize);

                document.addEventListener("keydown", this.handleKey.bind(this));

                this.foods.push(
                        new Food({ game: this, color: "yellow", spawnIn: 10, removeIn: 30,
                                   action: function()
                                   {
                                           this.game.increaseScore(1);
                                           this.game.resizeBody(this.game.body.length + 3);
                                           this.game.adjustSpeed(this.game.speed + 1);
                                   }
                        }),
                        new Food({ game: this, color: "red", spawnIn: 30, removeIn: 15,
                                   action: function()
                                   {
                                           this.game.increaseScore(this.game.body.length * 2);
                                           this.game.resizeBody(this.game.body.length * 2);
                                           this.game.adjustSpeed(this.game.speed + 1);
                                   }
                        }),
                        new Food({ game: this, color: "blue", spawnIn: 30, removeIn: 15,
                                   action: function()
                                   {
                                           this.game.increaseScore(this.game.body.length * 2);
                                           this.game.resizeBody(this.game.body.length / 2);
                                   }
                        }),
                        new Food({ game: this, color: "purple", spawnIn: 180, removeIn: 10,
                                   action: function()
                                   {
                                           this.game.increaseScore(this.game.score);
                                           this.game.resizeBody(1);
                                           this.game.adjustSpeed(1);
                                   }
                        }),
                        new Food({ game: this, color: "black", spawnIn: 120, removeIn: 30,
                                   action: function()
                                   {
                                           this.game.gameOver();
                                   }
                        })
                );

                this.updateMessage("Press N to start");
        },

        // Resets game status and starts a new game.
        //
        start: function() {
                this.scene.clear();
                this.playing = true,
                this.elapsedTime = 0;
                this.direction = DIRECTION.DOWN;
                this.nextDirections.length = 0;
                this.adjustSpeed(1);
                this.score = 0;
                this.body.length = 0;

                for (var i = 0; i < this.foods.length; i++) {
                        this.foods[i].scheduleSpawn();
                }

                this.body.push(this.getRandomFreePosition());
                this.drawHead();

                this.updateInfos();
                this.updateMessage("");
                this.updateElapsedTimeInterval = setInterval(this.updateElapsedTime.bind(this, 1), 1000);
        },

        // Callback for "keydown" events.
        //
        handleKey: function(event)
        {
                switch (event.key) {
                case "w": case "k": case "ArrowUp":
                        this.pushDirection(DIRECTION.UP);
                        break;
                case "s": case "j": case "ArrowDown":
                        this.pushDirection(DIRECTION.DOWN);
                        break;
                case "a": case "h": case "ArrowLeft":
                        this.pushDirection(DIRECTION.LEFT);
                        break;
                case "d": case "l": case "ArrowRight":
                        this.pushDirection(DIRECTION.RIGHT);
                        break;
                case "n":
                        if ( ! this.playing) {
                                this.start();
                        }
                        break;
                }
        },

        // Pushes dir inside nextDirections queue if it's not in conflict with
        // the last direction.
        //
        pushDirection: function(dir)
        {
                var lastDir = (this.nextDirections.length > 0) ?
                               this.nextDirections[this.nextDirections.length - 1] :
                               this.direction;
                switch (dir) {
                case DIRECTION.UP:
                case DIRECTION.DOWN:
                        if (lastDir !== DIRECTION.UP && lastDir !== DIRECTION.DOWN) {
                                this.nextDirections.push(dir);
                        }
                        break;
                case DIRECTION.LEFT:
                case DIRECTION.RIGHT:
                        if (lastDir !== DIRECTION.LEFT && lastDir !== DIRECTION.RIGHT) {
                                this.nextDirections.push(dir);
                        }
                        break;
                }
        },

        // Moves the snake by one position towards the current direction.
        // If nextDirections queue isn't empty, a direction is dequeued and it
        // will become the new current direction before performing the moving.
        //
        move: function()
        {
                if (this.nextDirections.length > 0) {
                        this.direction = this.nextDirections.shift();
                }

                var head = this.body[0];
                var tail = this.body.pop();
                tail.x = head.x;
                tail.y = head.y;
                this.body.unshift(tail);
                head = tail;

                switch (this.direction) {
                case DIRECTION.UP:
                        if (--head.y < 0) {
                                head.y = this.height - 1;
                        }
                        break;
                case DIRECTION.DOWN:
                        if (++head.y > this.height - 1) {
                                head.y = 0;
                        }
                        break;
                case DIRECTION.LEFT:
                        if (--head.x < 0) {
                                head.x = this.width - 1;
                        }
                        break;
                case DIRECTION.RIGHT:
                        if (++head.x > this.width - 1) {
                                head.x = 0;
                        }
                        break;
                }
        },

        // Resizes the body adding or deleting the necessary blocks.
        // newLength should be >= 1. If it's less than 1, it will become 1.
        //
        resizeBody: function(newLength)
        {
                newLength = Math.floor((newLength < 1) ? 1 : newLength);

                if (this.body.length < newLength) {
                        var tail = this.body[this.body.length - 1];
                        while (this.body.length < newLength) {
                                this.body.push(new Position(tail.x, tail.y));
                        }
                } else {
                        while (this.body.length > newLength) {
                                this.clearTail();
                                this.body.pop();
                        }
                }
        },

        // Return true if the body is currently growing i.e. if the tail
        // position is equal to the position that precedes it.
        //
        isGrowing: function()
        {
                var len = this.body.length;
                return len > 1 && this.body[len - 1].equals(this.body[len - 2]);
        },

        // Return the food object in position pos or null if there is no food in
        // position pos.
        //
        getFoodIn: function(pos)
        {
                for (var i = 0; i < this.foods.length; i++) {
                        if (this.foods[i].position.equals(pos)) {
                                return this.foods[i];
                        }
                }
                return null;
        },

        // Return true if there is a food object in position pos, false
        // otherwise.
        //
        collideWithFoods: function(pos)
        {
                return this.getFoodIn(pos) !== null;
        },

        // Return true if there is a body block in position pos, false
        // otherwise.
        // Takes an optional switch to ignore the head position.
        //
        collideWithBody: function(pos, ignoreHead)
        {
                var i = (ignoreHead) ? 1 : 0;
                for (; i < this.body.length; i++) {
                        if (this.body[i].equals(pos)) {
                                return true;
                        }
                }
                return false;
        },

        // Return a new free position i.e. a position not already occupied by a
        // body block or food.
        //
        getRandomFreePosition: function()
        {
                var pos = new Position(0, 0);
                do {
                        pos.x = Math.floor(Math.random() * this.width);
                        pos.y = Math.floor(Math.random() * this.height);
                } while (this.collideWithBody(pos) || this.collideWithFoods(pos));
                return pos;
        },

        // Changes the speed. This is realized by changing the interval time of
        // mainLoop, so this method can be used to (re)start the game.
        // speed should be between MIN_SPEED and MAX_SPEED, otherwise it will be
        // "forced" to those values.
        //
        adjustSpeed: function(speed)
        {
                if (speed < MIN_SPEED) {
                        this.speed = MIN_SPEED;
                } else if (speed > MAX_SPEED) {
                        this.speed = MAX_SPEED;
                } else {
                        this.speed = Math.floor(speed);
                }
                var time = Math.floor(MAX_MAINLOOP_INTERVAL_TIME - K * this.speed);
                clearInterval(this.mainLoopInterval);
                this.mainLoopInterval = setInterval(this.mainLoop.bind(this), time);
        },

        increaseScore: function(increment)
        {
                this.score += Math.floor(this.speed * increment + this.body.length);
        },

        // Puts the game in a gameover situation stopping everything.
        //
        gameOver: function()
        {
                this.playing = false;
                clearInterval(this.mainLoopInterval);
                clearInterval(this.updateElapsedTimeInterval);
                for (var i = 0; i < this.foods.length; i++) {
                        this.foods[i].delete();
                }
                this.updateMessage("GAME OVER! Press N to play again");
        },

        drawHead: function()
        {
                this.scene.drawBlock(this.body[0], this.blockSize, "green");
        },

        clearTail: function()
        {
                // if the snake is growing we should not clear the tail position
                // because there is at least another block in that position
                if ( ! this.isGrowing()) {
                        this.scene.clearBlock(this.body[this.body.length - 1],
                                              this.blockSize);
                }
        },

        mainLoop: function()
        {
                this.clearTail();
                this.move();
                this.drawHead();

                var head = this.body[0];

                if (this.collideWithBody(head, true)) {
                        this.gameOver();
                        return;
                }

                var food = this.getFoodIn(head);
                if (food !== null) {
                        food.scheduleSpawn();
                        food.action();  // executed after (re)spawn because action could be gameOver()
                        this.updateInfos();
                }
        },

        // Updates elapsed time both on the page and in the game status. secs
        // should match the number of seconds setted in the interval which calls
        // this method.
        //
        updateElapsedTime: function()
        {
                elapsedTimeElm = document.getElementById("elapsedTime");
                return function(secs)
                {
                        this.elapsedTime += secs;
                        elapsedTimeElm.innerHTML = this.getElapsedTimeHMS();
                };
        }(),

        getElapsedTimeHMS: function()
        {
                var h = Math.floor(this.elapsedTime / 60 / 60);
                var m = Math.floor(this.elapsedTime / 60 % 60);
                var s = Math.floor(this.elapsedTime % 60);
                return ((h > 9) ? '' : '0') + h + ':' +
                       ((m > 9) ? '' : '0') + m + ':' +
                       ((s > 9) ? '' : '0') + s;
        },

        updateInfos: function()
        {
                lengthElm = document.getElementById("length");
                speedElm = document.getElementById("speed");
                scoreElm = document.getElementById("score");
                return function()
                {
                        lengthElm.innerHTML = this.body.length;
                        speedElm.innerHTML = this.speed;
                        scoreElm.innerHTML = this.score;
                };
        }(),

        updateMessage: function(msg)
        {
                messageElm = document.getElementById("message");
                return function(msg)
                {
                        messageElm.innerHTML = msg;
                };
        }()
};


game.init();
