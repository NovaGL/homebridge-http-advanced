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
	}
  }
};
