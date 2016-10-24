
var Engine = {
	
    //Clickable objects
    Clickables: {
        hackButton:     null,
        
        //Load, save, and delete
        saveButton:     null,
        loadButton:     null,
        deleteButton:   null,
        
        //Main menu buttons
        terminalMainMenuButton:     null,
        characterMainMenuButton:    null,
    },
    
    //Display objects
    Display: {
        //Progress bar
        progress:       null,
        
        //Display for status text (such as "Saved" or "Loaded")
        statusText:     null,
        
        hacking_skill:   null,
        
        //Main menu content
        terminalContent:    null,
        characterContent:   null,
        
        //Character info
        characterInfo:      null,
    },
	
	//Time variables (milliseconds unix epoch time)
	_timeThen: new Date().getTime(),
	_timeNow: new Date().getTime(),
	
	_ticks: 0,          //Total ticks
	_idleSpeed: 200,    //Speed (in ms) at which the main loop is updated
    
    //Display a status update text
    _lastStatus: null,
    displayStatusText: function(text) {
        Engine.Display.statusText.innerHTML = text;
        
        clearTimeout(Engine._lastStatus);
        //Wipe status message after 3 seconds
        Engine._lastStatus = setTimeout(function() {
            Engine.Display.statusText.innerHTML = "";
        }, 3000);
    },
    
    //Save function
    saveFile: function() {
        var tempSaveFile = JSON.stringify(Player);
        
        window.localStorage.setItem("netburnerSave", tempSaveFile);
        
        Engine.displayStatusText("Saved!");
    },
    
    //Load saved game function
    loadSave: function() {
        //Check to see if file exists
        if (!window.localStorage.getItem("netburnerSave")) {
            Engine.displayStatusText("No save file present for load!");
        } else {
            var tempSaveFile = window.localStorage.getItem("netburnerSave");
            Player = JSON.parse(tempSaveFile);
            Engine.displayStatusText("Loaded successfully!");
        }
    },
    
    //Delete saved game function
    deleteSave: function() {
        if (!window.localStorage.getItem("netburnerSave")) {
            Engine.displayStatusText("No save file present for deletion");
        } else {
            window.localStorage.removeItem("netburnerSave");
            Engine.displayStatusText("Deleted successfully!");
        }
    },
    
    /* Load content when a main menu button is clicked */ 
    loadTerminalContent: function() {
        Engine.hideAllContent();
        Engine.Display.terminalContent.style.visibility = "visible";
		postNetburnerText();
    },
    
    loadCharacterContent: function() {
        Engine.hideAllContent();
        Engine.Display.characterContent.style.visibility = "visible";
        Engine.displayCharacterInfo();
    },
    
    //Helper function that hides all content 
    hideAllContent: function() {
        Engine.Display.terminalContent.style.visibility = "hidden";
        Engine.Display.characterContent.style.visibility = "hidden";
    },
    
    /* Display character info */
    displayCharacterInfo: function() {
        Engine.Display.characterInfo.innerHTML = 'Money: $' + Player.money + '<br><br>' +
                                                 'Hacking Level: ' + Player.hacking_skill + '<br><br>' + 
                                                 'Strength: ' + Player.strength + '<br><br>' + 
                                                 'Defense: ' + Player.defense + '<br><br>' + 
                                                 'Dexterity: ' + Player.dexterity + '<br><br>' + 
                                                 'Agility: ' + Player.agility + '<br><br>' +
												 'Servers owned: ' + Player.purchasedServers.length + '<br><br>';
    },
	
	/* Main Event Loop */
	idleTimer: function() {
		//Get time difference
		Engine._timeNow = new Date().getTime();
		var timeDifference = Engine._timeNow - Engine._timeThen - Engine._ticks;
		
		while (timeDifference >= Engine._idleSpeed) {			
			//Engine.Display.hacking_skill.innerHTML = Player.hacking_skill;
			
			//Update timeDifference based on the idle speed
			timeDifference -= Engine._idleSpeed;
			
			//Update the total tick counter
			Engine._ticks += Engine._idleSpeed;
		}
        
        var idleTime = Engine._idleSpeed - timeDifference;
        
		//Manual hack
		if (Player.startHack = true) {
			Engine._totalHackTime = Player.hackingTime;
			Engine._hackTimeLeft = Player.hackingTime;
			Engine._manualHackInProgress = true;
			Engine._hackProgressBarCount = 0;
			Engine._hackProgressStr = "[";
			Engine._hackTimeStr = "Time left: ";
			Player.startHack = false;
		}
		
		Engine.updateHackProgress();
		
		// Once that entire "while loop" has run, we call the IdleTimer 
		// function again, but this time with a timeout (delay) of 
		// _idleSpeed minus timeDifference
		setTimeout(Engine.idleTimer, idleTime);
		
	},
	
	/* Calculates the hack progress for a manual (non-scripted) hack and updates the progress bar/time accordingly */
	_totalHackTime: 0,
	_hackTimeLeft: 0,
	_hackTimeStr: "Time left: ",
	_hackProgressStr: "[",
	_hackProgressBarCount: 0,
	_manualHackInProgress: false,
	updateHackProgress: function() {
		if (Engine.manualHackInProgress) {
			Engine._hackTimeLeft -= (_idleSpeed/ 1000);	//Substract idle speed (ms)
		
			//Calculate percent filled 
			var percent = Math.floor((1 - Engine._hackTimeLeft / Engine.totalhackTime) * 100);
			
			//Update progress bar 
			if (Engine._hackProgressBarCount * 2 < percent) {
				Engine._hackProgressStr += '|';
				$('#hacking-progress-bar').html(Engine._hackProgressStr);
			}
			
			//Update hack time remaining
			Engine._hackTimeStr = "Time left: " + Engine._hackTimeLeft.asString();
			$('#hacking-progress').html(Engine._hackTimeStr);
			
			//Once percent is 100, the hack is completed
			if (percent == 100) {
				Engine.manualHackInProgress = false;
				Player.finishHack = true;
			}
		}
	},
	
    /* Initialization */
	init: function() {
		//Initialize Player objects
		Player.init();
		
		//Initialize foreign servers
		ForeignServers.init();
		
        //Load, save, and delete buttons
        //Engine.Clickables.saveButton = document.getElementById("save");
		//Engine.Clickables.saveButton.addEventListener("click", function() {
		//	Engine.saveFile();
		//	return false;
		//});
		
		//Engine.Clickables.loadButton = document.getElementById("load");
		//Engine.Clickables.loadButton.addEventListener("click", function() {
		//	Engine.loadSave();
		//	return false;
		//});
		
		//Engine.Clickables.deleteButton = document.getElementById("delete");
		//Engine.Clickables.deleteButton.addEventListener("click", function() {
		//	Engine.deleteSave();
		//	return false;
		//});
        
        //Main menu buttons and content
        Engine.Clickables.terminalMainMenuButton = document.getElementById("terminal-menu-link");
        Engine.Clickables.terminalMainMenuButton.addEventListener("click", function() {
            Engine.loadTerminalContent();
            return false;
        });
        
        Engine.Clickables.characterMainMenuButton = document.getElementById("character-menu-link");
        Engine.Clickables.characterMainMenuButton.addEventListener("click", function() {
            Engine.loadCharacterContent();
            return false;
        });
        
        Engine.Display.terminalContent = document.getElementById("terminal-container");
        Engine.Display.characterContent = document.getElementById("character-container");
        Engine.Display.characterContent.style.visibility = "hidden";
        
        //Character info
        Engine.Display.characterInfo = document.getElementById("character-info");
        Engine.displayCharacterInfo();
        
        //Message at the top of terminal
		postNetburnerText();
        
        //Run main loop
		Engine.idleTimer();
	}
};

window.onload = function() {
	Engine.init();
};


	

		