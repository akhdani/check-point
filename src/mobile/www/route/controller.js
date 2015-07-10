define([
    'asset/lib/momentjs/min/moment.min',
    'asset/lib/socket.io-client/socket.io'
], function(moment, io){
    // add socket.io support
    alt.module('btford.socket-io');
    alt.factory('$socket', function (socketFactory) {
        return socketFactory({
            ioSocket: io.connect(alt.serverUrl)
        });
    });

    return ['$scope', '$routeParams', '$log', '$timeout', '$interval', '$socket', '$cordovaGeolocation', '$cordovaBackgroundGeolocation', function($scope, $routeParams, $log, $timeout, $interval, $socket, $cordovaGeolocation, $cordovaBackgroundGeolocation){
        $scope.ceil = Math.ceil;
        $scope.player = {
            id: store.get('playerid') || -1,
            name: store.get('playername') || '',
            isgrabbable: [],
            grabbed: [],
            latitude: null,
            longitude: null
        };
        $scope.game = {
            is_started: false,
            flags: []
        };
        $scope.show = 'map';

        // register function
        $scope.register = function(){
            if($scope.player.name){
                $socket.emit('register', {name: $scope.player.name}, function(e, data){
                    if(e) $log.error(e);
                    $scope.player = alt.extend($scope.player, data);
                    $scope.$apply();
                    store.set('playerid', $scope.player.id);
                    store.set('playername', $scope.player.name);
                    $socket.emit('join', {id: $scope.player.id}, function(e, data){
                        if(e) $log.error(e);
                    });
                });
            }
        };

        // move function
        $scope.move = function(){
            if($scope.player.id != -1){
                $socket.emit('move', {id: $scope.player.id, name: $scope.player.name, latitude: $scope.player.latitude, longitude: $scope.player.longitude}, function(e, data) {
                    if (e) $log.error(e);
                    $scope.map.redraw();
                });
            }
        };

        // grab function
        $scope.grab = function(){
            //console.log('grab');
            $socket.emit('grab', {id: $scope.player.id, name: $scope.player.name, latitude: $scope.player.latitude, longitude: $scope.player.longitude}, function(e, data){
                if(e) $log.error(e);
            });
        };

        // listening on any change from server
        $socket.on('game', function(data){
            $scope.game = alt.extend($scope.game, data);
            //console.log('game', angular.toJson(data));

            // redraw position
            $scope.map.redraw();
        });

        // gmap handler
        $scope.map = {
            elementid: 'map',
            object: null,
            zoom: 17,
            latitude: -6.89521975,
            longitude: 107.63844252,
            marker: [],
            circles: [],
            first: true,
            redraw: function(){
                if($scope.map.object && google && google.maps){
                    // reset map marker
                    for(var i=0; i<$scope.map.marker.length; i++){
                        $scope.map.marker[i].setMap(null);
                    }
                    $scope.map.marker = [];
                    $scope.map.bounds = new google.maps.LatLngBounds();

                    // reset flag circle
                    for(var j=0; j<$scope.game.flags.length; j++) {
                        if ($scope.map.circles[j]) $scope.map.circles[j].setMap(null);
                    }
                    $scope.map.circles = [];

                    // markers need to draw
                    var markers = [];

                    // draw flag
                    angular.forEach($scope.game.flags, function(val, key) {
                        markers.push(alt.extend({
                            type: 'flag',
                            name: 'Flag',
                            route: (key+1) + ' of ' + $scope.game.flags.length
                        }, val));
                    });

                    // draw all players
                    angular.forEach($scope.game.players, function(val, key){
                        var route = 0;
                        for(var i=0; i<val.grabbed.length; i++){
                            if(val.grabbed[i]) route++;
                        }

                        var tmp = alt.extend({
                            type: val.id == $scope.player.id ? 'me' : ('player' + (moment(val.time, 'X').isValid() && moment().diff(moment(val.time, 'X'), 'seconds') <= 120 ? '' : '-off')),
                            route: route + ' of ' + $scope.game.flags.length
                        }, val);
                        markers.push(tmp);

                        if(val.id == $scope.player.id){
                            $scope.player = val;
                            console.log($scope.player.route);
                            $scope.$apply();

                            store.set('playerid', $scope.player.id);
                            store.set('playername', $scope.player.name);
                        }
                    });

                    //console.log('markers');
                    //console.log(angular.toJson(markers));
                    for(var i=0; i<markers.length; i++){
                        var latitude = markers[i].latitude,
                            longitude = markers[i].longitude;

                        if (latitude != '' && typeof latitude !== 'undefined' && latitude != null &&
                            longitude != '' && typeof longitude !== 'undefined' && longitude != null) {

                            // create new marker
                            var position = new google.maps.LatLng(latitude, longitude);
                            var marker = new google.maps.Marker({
                                data: markers[i],
                                position: position,
                                map: $scope.map.object,
                                icon: 'asset/img/marker/' + markers[i].type + '.png',
                                infoWindow: {
                                    content: '<div style="color: black; min-width: 150px; min-height: 70px; overflow: none;">'
                                    + '<h5> Nama : ' + (markers[i].name || '') + '</h5>'
                                    + '<h6> Check Point : ' + (markers[i].route || '') + '</h6>'
                                    + '<h6> Latitude : ' + (markers[i].latitude || '') + '</h6>'
                                    + '<h6> Longitude : ' + (markers[i].longitude || '') + '</h6>'
                                    + '</div>'
                                }
                            });

                            $scope.map.marker.push(marker);

                            google.maps.event.addListener($scope.map.marker[$scope.map.marker.length - 1], 'click', function(){
                                var marker = this;
                                $scope.map.info.close();
                                $scope.map.info.setContent(marker.infoWindow.content);
                                $scope.map.info.open($scope.map.object, marker);
                            });
                            $scope.map.bounds.extend(position);


                            // add circle radius to flag
                            if(markers[i].type == 'flag'){
                                $scope.map.circles.push(new google.maps.Circle({
                                    center: position,
                                    radius: $scope.game.flags[i].distance,
                                    strokeColor: "#FF0000",
                                    strokeOpacity: 0.8,
                                    strokeWeight: 2,
                                    fillColor: "#FF0000",
                                    fillOpacity: 0.35,
                                    map: $scope.map.object
                                }));
                            }
                        }
                    }

                    // ------------- bound map with marker
                    if ($scope.map.marker.length > 0 && $scope.map.first) {
                        $scope.map.object.fitBounds($scope.map.bounds);
                        $scope.map.first = false;
                    }
                    google.maps.event.trigger($scope.map.object, "resize");
                }
            }
        };

        // load google maps
        require([
            'async!http://maps.googleapis.com/maps/api/js?key=' + alt.registry.GMAP_KEY + '&sensor=false&language=id'
        ], function(){
            $scope.map.element = document.getElementById($scope.map.elementid);
            $scope.map.center = new window.google.maps.LatLng($scope.map.latitude, $scope.map.longitude);
            $scope.map.options = {
                center: $scope.map.center,
                zoom: $scope.map.zoom,
                mapTypeId: window.google.maps.MapTypeId.ROADMAP
            };

            $scope.map.object = new window.google.maps.Map($scope.map.element, $scope.map.options);
            $scope.map.info = new google.maps.InfoWindow;
            $scope.map.redraw();
        });

        $scope.watch_position = function(){
            if(window.GPSLocation) return GPSLocation.watchPosition(function(position) {
                //console.log(position);
                $scope.player.latitude = position.coords.latitude;
                $scope.player.longitude = position.coords.longitude;
                $scope.$apply();

                if($scope.player.id != -1){
                    $scope.move();
                }else{
                    $scope.player.latitude = position.coords.latitude;
                    $scope.player.longitude = position.coords.longitude;
                    $scope.$apply();
                }
            }, function (error) {
                $log.error(error);
            }, { timeout: 5000 });
        };
        $scope.watch = $scope.watch_position();

        if(window.cordova && cordova.plugins && cordova.plugins.backgroundMode){
            cordova.plugins.backgroundMode.setDefaults({
                ticker: 'Capture-The-Flag',
                title: 'Capture The Flag',
                text:'Running in background...'
            });
            cordova.plugins.backgroundMode.enable();


            // Called when background mode has been activated
            cordova.plugins.backgroundMode.onactivate = function(){
                console.log('backgroundMode.onactivate ' + cordova.plugins.backgroundMode.isEnabled() + ' ' + cordova.plugins.backgroundMode.isActive());

                GPSLocation.clearWatch($scope.watch);
                $scope.watch = $scope.watch_position();

                setInterval(function(){
                    console.log('backgroundMode.onactivate interval ' + cordova.plugins.backgroundMode.isEnabled() + ' ' + cordova.plugins.backgroundMode.isActive());
                }, 200);
            };

            cordova.plugins.backgroundMode.ondeactivate = function(){
                console.log('backgroundMode.ondeactivate ' + cordova.plugins.backgroundMode.isEnabled() + ' ' + cordova.plugins.backgroundMode.isActive());
            };

            cordova.plugins.backgroundMode.onfailure = function(error){
                console.log('backgroundMode.onfailure ' + error);
            };
        }
    }];
});