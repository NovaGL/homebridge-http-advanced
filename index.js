var Service, Characteristic;
var request = require("request");
var pollingtoevent = require('polling-to-event');

module.exports = function(homebridge){
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-http-advanced", "Http-advanced", HttpAdvancedAccessory);
}


function HttpAdvancedAccessory(log, config) {
  this.log = log;

 	// url info
	this.on_url                 = config["on_url"];
	this.on_body                = config["on_body"];
	this.off_url                = config["off_url"];
	this.off_body               = config["off_body"];
	this.lock_url               = config["lock_url"]; 
	this.lock_body              = config["lock_body"];
	this.unlock_url             = config["unlock_url"]  			|| this.lock_url;
	this.unlock_body            = config["unlock_body"] 			|| this.lock_body;
	this.status_url             = config["status_url"];
	this.brightness_url         = config["brightness_url"];
	this.brightnesslvl_url      = config["brightnesslvl_url"];
	this.http_method            = config["http_method"] 	  	 	|| "GET";
	this.http_brightness_method = config["http_brightness_method"] 	|| this.http_method;
	this.http_lock_method       = config["http_lock_method"] 	 	|| this.http_method;
	this.username               = config["username"] 	  	 	 	|| "";
	this.password               = config["password"] 	  	 	 	|| "";
	this.sendimmediately        = config["sendimmediately"] 	 	|| "";
	this.service                = config["service"] 	  	 	 	|| "Switch";
	this.name                   = config["name"];
	this.manufacturer           = config["manufacturer"] 	 	|| "HTTP Manufacturer";
	this.model                  = config["model"] 	 	      || "HTTP Model";
	this.serial_number					= config["serial_number"] 				|| "HTTP Serial Number";
	this.brightnessHandling     = config["brightnessHandling"] 	 	|| "no";
	this.switchHandling 	    = config["switchHandling"] 		 	|| "no";
	this.close_url 				= config["close_url"];
	this.close_body 			= config["close_body"];
	this.open_url 				= config["open_url"] || this.close_url;
	this.open_body 				= config["open_body"] || this.close_body;
	this.http_close_method      = config["http_close_method"] 	 	|| this.http_method;
	this.door_open_timer 		= config["door_open_timer"] || 20;
	this.door_sensor_present 	= config["door_sensor_present"] || false;

	this.state = false;
	
	this.currentlevel = 0;
    	var that = this;

	// Status Polling
	if ((this.status_url && this.switchHandling =="realtime") || (this.service=="Smoke" || this.service=="Motion")) {
		var powerurl = this.status_url;
		var statusemitter = pollingtoevent(function(done) {
	        	that.httpRequest(powerurl, "", "GET", that.username, that.password, that.sendimmediately, function(error, response, body) {
            		if (error) {
                		that.log('HTTP get power function failed: %s', error.message);
		                callback(error);
            		} else {               				    
				done(null, body);
            		}
        		})
    	}, {longpolling:true,interval:300,longpollEventName:"statuspoll"});

	statusemitter.on("statuspoll", function(data) {       
        	var binaryState = parseInt(data);
	    	that.state = binaryState > 0;
		that.log(that.service, "received data:"+that.status_url, "state is currently", binaryState); 

		switch (that.service) {
			case "Switch":
				if (that.switchService ) {
					that.switchService .getCharacteristic(Characteristic.On)
					.setValue(that.state);
				}
				break;
			case "Light":
				if (that.lightbulbService) {
					that.lightbulbService.getCharacteristic(Characteristic.On)
					.setValue(that.state);
				}		
				break;
			case "Smoke":
				if (that.smokeService) {
					that.smokeService.getCharacteristic(Characteristic.SmokeDetected)
					.setValue(that.state);
				}
				break;
			case "Motion":
				if (that.motionService) {
					that.motionService.getCharacteristic(Characteristic.MotionDetected)
					.setValue(that.state);
				}		
			break;
			case "GarageDoorOpener":
				if (that.garageDoorService) {
					that.state = binaryState;
					that.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState)
						.setValue(that.state);
				}
			break;
			}        
    });

}
	// Brightness Polling
	if (this.brightnesslvl_url && this.brightnessHandling =="realtime") {
		var brightnessurl = this.brightnesslvl_url;
		var levelemitter = pollingtoevent(function(done) {
	        	that.httpRequest(brightnessurl , "", "GET", that.username, that.password, that.sendimmediately, function(error, response, responseBody) {
            		if (error) {
                			that.log('HTTP get power function failed: %s', error.message);
							return;
            		} else {               				    
						done(null, responseBody);
            		}
        		})
    	}, {longpolling:true,interval:2000,longpollEventName:"levelpoll"});

		levelemitter.on("levelpoll", function(data) {  
			that.currentlevel = parseInt(data);

			if (that.lightbulbService) {				
				that.log(that.service, "received data:"+that.brightnesslvl_url, "level is currently", that.currentlevel); 		        
				that.lightbulbService.getCharacteristic(Characteristic.Brightness)
				.setValue(that.currentlevel);
			}        
    	});
	}
}

HttpAdvancedAccessory.prototype = {

	httpRequest: function(url, body, method, username, password, sendimmediately, callback) {
		request({
			url: url,
			body: body,
			method: method,
			rejectUnauthorized: false,
			auth: {
				user: username,
				pass: password,
				sendImmediately: sendimmediately
			}
		},
		function(error, response, body) {
			callback(error, response, body)
		})
	},
	getStatusState: function(callback) {
		if (!this.status_url) {
    			this.log.warn("Ignoring request; No status url defined.");
	    		callback(new Error("No status url defined."));
	    		return;
   		 }
    
    	var service = this.service;
		var url = this.status_url;
    	this.log("Getting" , service , "state");

    	this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
				this.log('HTTP get power function failed: %s', error.message);
				callback(error);
			} else {
				var binaryState = parseInt(responseBody);
				var powerOn = binaryState > 0;
				this.log(service, "state is currently", binaryState);
				callback(null, powerOn);
			}
	    }.bind(this));
	  },

	setPowerState: function(powerOn, callback) {
		var url;
		var body;
	
		if (!this.on_url || !this.off_url) {
			this.log.warn("Ignoring request; No power url defined.");
			callback(new Error("No power url defined."));
			return;
		}
	
		if (powerOn) {
			url = this.on_url;
			body = this.on_body;
			this.log("Setting power state to on");
		} else {
			url = this.off_url;
			body = this.off_body;
			this.log("Setting power state to off");
		}
	
		this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
				this.log('HTTP set power function failed: %s', error.message);
				callback(error);
			} else {
				this.log('HTTP set power function succeeded!');
				callback();
			}
		}.bind(this));
	},
  
	getLockCurrentState: function(callback){
		this.log("getLockCurrentState");
		callback(null, 1); //Not possible with my setup
	},
	setLockCurrentState: function(callback){
		this.log("setLockCurrentState");
		callback(null, 1); //Not possible with my setup
	},
	getLockTargetState: function(callback){
		this.log("getLockTargetState");
		callback(null, 1); //Not possible with my setup
	},

	setLockTargetState: function(powerOn,callback) {
		var url;
		var body;

		if (!this.unlock_url || !this.lock_url) {
			this.log.warn("Ignoring request; No Door url defined.");
			callback(new Error("No Door url defined."));
		    return;
		}

	    if (powerOn) {
			url = this.lock_url;
			body = this.lock_body;
			this.log("Locking Door");
	    } else {
      		url = this.unlock_url;
            body = this.unlock_body;
      		this.log("Unlocking Door");
	    }
		this.httpRequest(url, body, this.http_lock_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
				this.log('HTTP Door function failed: %s', error.message);
				callback(error);
			} else {
				this.log('HTTP Door function succeeded!');
				callback();
			}
		}.bind(this));
	},


	getBrightness: function(callback) {
		if (!this.brightnesslvl_url) {
			this.log.warn("Ignoring request; No brightness level url defined.");
			callback(new Error("No brightness level url defined."));
			return;
		}		
		var url = this.brightnesslvl_url;
		this.log("Getting Brightness level");

		this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
				this.log('HTTP get brightness function failed: %s', error.message);
				callback(error);
			} else {			
				var level = parseInt(responseBody);				
				this.log("brightness state is currently %s", level);
				callback(null, level);
			}
		}.bind(this));
	},

	setBrightness: function(level, callback) {
	
		if (!this.brightness_url) {
			this.log.warn("Ignoring request; No brightness url defined.");
			callback(new Error("No brightness url defined."));
			return;
		}    
		if (!this.on_url || !this.off_url) {
			this.log.warn("Ignoring request; No power url defined.");
			callback(new Error("No power url defined."));
			return;
		}
		
		var url = this.brightness_url.replace("%b", level)
		
		this.log("Setting brightness to %s", level);
		
		this.httpRequest(url, "", this.http_brightness_method, this.username, this.password, this.sendimmediately, function(error, response, body) {
			if (error) {
				this.log('HTTP brightness function failed: %s', error);
				callback(error);
			} else {
				this.log('HTTP brightness function succeeded!');
				callback();
			}
		}.bind(this));
	},

	getTargetDoorState: function(callback) {
		var targetDoorState = this.garageDoorService.getCharacteristic(Characteristic.TargetDoorState).value;
		callback(null, targetDoorState);
	},

	setTargetDoorState: function(state, callback) {
		var value = state | 0;
		callback = callback || function() { };

		this.homekitTriggered = true;

		var currentDoorState = this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState);

		if (this.isMoving !== true && value == Characteristic.TargetDoorState.CLOSED && currentDoorState.value == Characteristic.CurrentDoorState.CLOSED) {
			this.log("Door already closed");
			callback(null);
			return;
		}

		if (!this.open_url || !this.close_url) {
			this.log.warn("Ignoring request; No Door url defined.");
			callback(new Error("No Door url defined."));
			return;
		}

		var url;
		var body;

		if (value == Characteristic.TargetDoorState.CLOSED) {
			url = this.close_url;
			body = this.close_body;
			this.log("Closing Garage Door");
		} else if (value == Characteristic.TargetDoorState.OPEN) {
			url = this.open_url;
			body = this.open_body;
			this.log("Opening Garage Door");
		}

		this.httpRequest(url, body, this.http_close_method, this.username, this.password, this.sendimmediately, function(error, response, body) {
			if (error) {
				this.log('HTTP Garage Door function failed: %s', error);
				callback(error);
			} else {
				this.log('HTTP Garage Door function succeeded!');

				this.setDoorMoving(value, true);

				callback(null);
			}
		}.bind(this));
	},

	getCurrentDoorState: function(callback) {
		if (!this.status_url) {
			this.log.warn("Ignoring request; No status url defined.");
			callback(new Error("No status url defined."));
			return;
		}

		var service = this.garageDoorService;
		var url = this.status_url;
		this.log("Getting current door state");

		this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
				this.log('HTTP get current door state function failed: %s', error.message);
				callback(error);
			} else {
				var status = parseInt(responseBody);
				this.log(this.service, "current door state is currently", status);
				callback(null, status);
			}
		}.bind(this));
	},

	setCurrentDoorState: function(value, callback) {
		var state;

		switch (value) {
			case Characteristic.CurrentDoorState.OPEN:
				state = "Open";
				break;
			case Characteristic.CurrentDoorState.CLOSED:
				state = "Closed";
				break;
			case Characteristic.CurrentDoorState.OPENING:
				state = "Opening";
				break;
			case Characteristic.CurrentDoorState.CLOSING:
				state = "Closing";
				break;
			case Characteristic.CurrentDoorState.STOPPED:
				state = "Stopped";
				break;
		}

		this.garageDoorService
			.getCharacteristic(Characteristic.TargetDoorState)
			.updateValue(value);

		if (callback) callback();
	},

	setDoorMoving: function(targetDoorState, homekitTriggered) {
		var service = this.garageDoorService;

		if (this.movingTimer) {
			clearTimeout(this.movingTimer);
			delete this.movingTimer;
		}

		if (this.isMoving === true) {
			delete this.isMoving;
			this.setCurrentDoorState(Characteristic.CurrentDoorState.STOPPED);

			// Toggle TargetDoorState after receiving a stop
			setTimeout(
				function(obj, state) {
					obj.updateValue(state);
				},
				500,
				service.getCharacteristic(Characteristic.TargetDoorState),
				targetDoorState == Characteristic.TargetDoorState.OPEN ? Characteristic.TargetDoorState.CLOSED : Characteristic.TargetDoorState.OPEN
			);
			return;
		}

		this.isMoving = true;

		if (homekitTriggered === true) {
			var currentDoorState = service.getCharacteristic(Characteristic.CurrentDoorState);

			if (targetDoorState == Characteristic.TargetDoorState.CLOSED) {
				if (currentDoorState.value != Characteristic.CurrentDoorState.CLOSED) {
					this.setCurrentDoorState(Characteristic.CurrentDoorState.CLOSING);
				}
			}
			else if (targetDoorState == Characteristic.TargetDoorState.OPEN) {
				if ((this.door_sensor_present !== true && currentDoorState.value != Characteristic.CurrentDoorState.OPEN) || currentDoorState.value == Characteristic.CurrentDoorState.STOPPED) {
					this.setCurrentDoorState(Characteristic.CurrentDoorState.OPENING);
				}
			}
		}

		this.movingTimer = setTimeout(function(self) {
			delete self.movingTimer;
			delete self.isMoving;

			var targetDoorState = self.garageDoorService.getCharacteristic(Characteristic.TargetDoorState);

			if (self.door_sensor_present !== true) {
				self.setCurrentDoorState(targetDoorState.value ? Characteristic.CurrentDoorState.CLOSED : Characteristic.CurrentDoorState.OPEN);
				return;
			}

			self.getCurrentDoorState(function(err, status) {
				if (!err) {
					self.setCurrentDoorState(status ? Characteristic.CurrentDoorState.CLOSED : Characteristic.CurrentDoorState.OPEN);
				}
			});
		}, this.door_open_timer * 1000, this);
	},

  identify: function(callback) {
    this.log("Identify requested!");
    callback(); // success
  },

  getServices: function() {
	var that = this;	
    
    var informationService = new Service.AccessoryInformation();

    informationService
    .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
    .setCharacteristic(Characteristic.Model, this.model)
    .setCharacteristic(Characteristic.SerialNumber, this.serial_number);

	switch (this.service) {
		case "Switch": 
			this.switchService = new Service.Switch(this.name);
			switch (this.switchHandling) {			
				case "yes":					
					this.switchService
					.getCharacteristic(Characteristic.On)
					.on('get', this.getStatusState.bind(this))
					.on('set', this.setPowerState.bind(this));
					return [this.switchService];	
					break;
				case "realtime":				
					this.switchService
					.getCharacteristic(Characteristic.On)
					.on('get', function(callback) {callback(null, that.state)})
					.on('set', this.setPowerState.bind(this));
					return [this.switchService];
					break;
				default	:	
					this.switchService
					.getCharacteristic(Characteristic.On)	
					.on('set', this.setPowerState.bind(this));
					return [this.switchService];	
					break;}
		case "Light":	
			this.lightbulbService = new Service.Lightbulb(this.name);			
			switch (this.switchHandling) {
	
			case "yes" :
				this.lightbulbService
				.getCharacteristic(Characteristic.On)
				.on('get', this.getStatusState.bind(this))
				.on('set', this.setPowerState.bind(this));
				break;
			case "realtime":
				this.lightbulbService
				.getCharacteristic(Characteristic.On)
				.on('get', function(callback) {callback(null, that.state)})
				.on('set', this.setPowerState.bind(this));
				break;
			default:		
				this.lightbulbService
				.getCharacteristic(Characteristic.On)	
				.on('set', this.setPowerState.bind(this));
				break;
			}
			
			if (this.brightnessHandling == "realtime") {
				this.lightbulbService 
				.addCharacteristic(new Characteristic.Brightness())
				.on('get', function(callback) {callback(null, that.currentlevel)})
				.on('set', this.setBrightness.bind(this));
			} else if (this.brightnessHandling == "yes") {
				this.lightbulbService
				.addCharacteristic(new Characteristic.Brightness())
				.on('get', this.getBrightness.bind(this))
				.on('set', this.setBrightness.bind(this));							
			}
	
			return [informationService, this.lightbulbService];
			break;
		case "Door":
			var lockService = new Service.LockMechanism(this.name);
		
			lockService 
			.getCharacteristic(Characteristic.LockCurrentState)
			.on('get', this.getLockCurrentState.bind(this))
			.on('set', this.setLockCurrentState.bind(this));
		
			lockService 
			.getCharacteristic(Characteristic.LockTargetState)
			.on('get', this.getLockTargetState.bind(this))
			.on('set', this.setLockTargetState.bind(this));
		
			return [lockService];
			break;
		case "Smoke":
			this.smokeService = new Service.SmokeSensor(this.name);
			this.switchHandling=="realtime";
	
			this.smokeService
			.getCharacteristic(Characteristic.SmokeDetected)
			.on('get', function(callback) {callback(null, that.state)});
	
			return [this.smokeService];
		case "Motion":
			this.motionService = new Service.MotionSensor(this.name);
			this.switchHandling=="realtime";				
			this.motionService
			.getCharacteristic(Characteristic.MotionDetected)
			.on('get', function(callback) {callback(null, that.state)});
	
			return [this.motionService];
			break;

		case "GarageDoorOpener":
			this.garageDoorService = new Service.GarageDoorOpener(this.name);

			this.garageDoorService
				.getCharacteristic(Characteristic.CurrentDoorState)
				.on('get', this.getCurrentDoorState.bind(this))
				.on('set', this.setCurrentDoorState.bind(this));

			this.garageDoorService
				.getCharacteristic(Characteristic.TargetDoorState)
				.on('get', this.getTargetDoorState.bind(this))
				.on('set', this.setTargetDoorState.bind(this));

			return [informationService, this.garageDoorService];
		}
  }
};
