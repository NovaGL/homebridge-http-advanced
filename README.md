# homebridge-http-advanced

Supports https devices on the HomeBridge Platform and provides a real time polling for getting the "On" and brightness level characteristics to Homekit. Includes Switch, Light, Door, Smoke and Motion sensor polling.

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin by cloning this repo.
3. Update your configuration file. See sample-config.json in this repository for a sample. 

# Configuration

The configuration for this plugin is the same as [homebridge-http](https://github.com/rudders/homebridge-http) but includes an additional method to read the power state of the device and the brightness level. Specify the `status_url` in your config.json that returns the status of the device as an integer (0 = off, 1 = on). Specify the `brightnesslvl_url` to return the current brighness level as an integer. 

Switch handling and brightness handling support 3 methods, yes for polling on app load, realtime for constant polling or no polling

Configuration sample:

 ```
"accessories": [ 
	{
		"accessory": "Http",
		"name": "Alfresco Lamp",
		"switchHandling": "realtime",
		"http_method": "GET",
		"on_url":      "http://localhost/controller/1700/ON",
		"off_url":     "http://localhost/controller/1700/OFF",
		"status_url":  "http://localhost/status/100059",
		"service": "Light",
		"brightnessHandling": "yes",
		"brightness_url":     "http://localhost/controller/1707/%b",
		"brightnesslvl_url":  "http://localhost/status/100054",
		"sendimmediately": "",
		"username" : "",
		"password" : ""					    
       } 
    ]
```

# Services

Each service shows up as a specific HomeKit device.

Service|URL Type|Data format|Description
-------|--------|-----------|------------
Lux|brightnesslvl_url|JSON: { "lightlevel": 94.00 }|Ambient light sensor
Occupancy|status_url|Integer: 1 or 0|Occupancy Sensor
Motion|status_url|Integer: 1 or 0|Motion Sensor
Light|status_url|Integer: 1 or 0|Switch status for the light
Light|brightnesslvl_url| Integer: 0 to 100|Current brightness percentage for the light
