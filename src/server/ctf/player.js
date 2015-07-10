var id = 1,
    moment = require('moment'),
    helper = require('./helper');

module.exports = function(name, latitude, longitude){
    var self = this;

    self.id = id++;
    self.name = name;
    self.game = null;

    // player isgrabbable
    self.isgrabbable = [];

    // player grabbed
    self.grabbed = [];

    // player location history
    self.locations = [];

    // player location
    self.latitude = latitude;
    self.longitude = longitude;

    // player last active time
    self.time = moment().format('X');

    // join game
    self.join = function(game, password){
        if(self.game != null) throw new Error('Player ' + self.name + ' is already in game');

        game.join(self, password);
        self.time = moment().format('X');

        // copy flags from game
        for(var i=0; i<self.game.flags.length; i++){
            self.isgrabbable.push(false);
            self.grabbed.push(false);
        }
    };

    // leave game
    self.leave = function(){
        if(self.game == null) throw new Error('Player ' + self.name + ' is not in game');

        self.game.leave();
    };

    // start game
    self.start = function(){
        if(self.game == null) throw new Error('Player ' + self.name + ' is not in game');
        if(self.game.creator != self) throw new Error('Player is not the game creator');

        self.game.start();
        self.time = moment().format('X');
    };

    // stop game
    self.stop = function(){
        if(self.game == null) throw new Error('Player ' + self.name + ' is not in game');
        if(self.game.creator != self) throw new Error('Player is not the game creator');
        if(!self.game.is_started) throw new Error('Game is not started');

        self.game.stop();
    };

    // on the move
    self.move = function(data){
        if(self.game == null) throw new Error('Player ' + self.name + ' is not in game');

        // set player location
        self.latitude = data.latitude;
        self.longitude = data.longitude;
        self.time = moment().format('X');

        // save to player location history
        self.locations.push({
            latitude: self.latitude,
            longitude: self.longitude,
            time: self.time
        });

        // if player is holding flag, change flag location too
        /*if(self.game.flag.holder == self){
            self.game.flag.move(self);
        }*/
    };

    // grab the flag
    self.grab = function(data){
        if(self.game == null) throw new Error('Player ' + self.name + ' is not in game');
        if(!self.game.is_started)  throw new Error('Game flag is not started');
        if(self.game.flags.length == 0)  throw new Error('Game flag is not set');

        //self.game.flag.grab(self);
        var index = self.isgrabbable.indexOf(true);
        if(index < 0) throw new Error('No flag is grabbable');

        for(var i=0; i<index; i++){
            if(!self.grabbed[i]) throw new Error('Follow the route');
        }
        self.grabbed[i] = true;
    };

    // return player as normal js object
    self.data = function(){
        var id = 0;
        for(var i=0; i<self.grabbed.length; i++){
            if(!self.grabbed[i]){
                id = 0;
                break;
            }
        }

        var distance = Math.ceil(helper.get_distance(self.latitude, self.longitude, self.game.flags[id].latitude, self.game.flags[id].longitude)),
            direction = helper.get_direction(self.latitude, self.longitude, self.game.flags[id].latitude, self.game.flags[id].longitude);

        for(var i=0; i<self.game.flags.length; i++){
            try{
                self.isgrabbable[i] = self.game.flags[i].isgrabbable(self);
            }catch(e){
                self.isgrabbable[i] = false;
            }
        }

        return {
            id: self.id,
            name: self.name,
            latitude: self.latitude,
            longitude: self.longitude,
            isgrabbable: self.isgrabbable,
            grabbed: self.grabbed,
            time: self.time,
            distance: distance || 0,
            direction: direction || 0
        };
    };
};