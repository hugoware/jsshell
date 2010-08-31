/*
 * jsshell : Chrome Extension
 * Hugo Bonacci (http://www.hugoware.net)
 * Libraries used by jsshell
 */
 
//aliases for additional functions
var jsshell;
var js;

//script for executing a script in a separate area from the shell
//but probably does little actually protect anything
function ____execute__jsshell___script(script) {
    eval(script);
}

//create a new jsshell class 
(function() {
    
    //create the shell
    var shell = {
    
        //constants for the shell
        PORT_NAME:"jsshell",
        RESOURCE_URL:"http://www.hugoware.net/chrome_plugin/",
        EDITOR_OFFSET:15,
        EDITOR_START_OFFSET:40,
        EDITOR_OPACITY:0.3,
        ANIMATION_SPEED:300,
        KEY_ENTER:13,
        KEY_TAB:9,
        KEY_DELETE:46,
        KEY_DOWN_ARROW:40,
        KEY_F1:112,
        KEY_QUESTION:191,
        TAB_INSERT:"    ",
        DEFAULT_NOTE_DURATION:4000,
        NOTE_INTERVAL:250,
        NOTE_OFFSET:25,
        ERROR_COLOR:"#090",
        
        //colors for elements on the page
        AUTOCOMPLETE_COLORS:{
            "css":"#9cd75d",
            "id":"#d77628",
            "element":"#528def",
            "jQuery":"#b36ecd",
            "jLinq":"#6ecdbe",
            "jsshell":"#8f8f8f"
        },
        
        //utility functions used by other classes
        util: {
            
            //merges one clas into another
            merge:function(target, source) { 
                target = target == null ? {} : target;
                for(var item in source) { 
                    target[item] = source[item]; 
                } 
                return target; 
            },
            
            //returns a path to a remote resource file
            resourceUrl:function(file) {
                return [shell.RESOURCE_URL, file].join("");
            },
            
            //make sure a string matches another
            equals:function(value, compare) {
                if (!(value && compare)) { return false; }
                var expression = new RegExp(["^", value.toString(), "$"].join(""), "i");
                return compare.match(expression);
            },
            
            //very limited encoding of strings
            encode:function(str) {
                str = (str ? str : "").toString();
                return str.replace(/\&/g, "&amp;")
                    .replace(/</g,"&lt;")
                    .replace(/>/g, "&gt;");
            },
            
            //create a regex escaped version of the current address
            escapeCurrentUrl:function() {
                var url = window.location.toString();
                url = url.replace(/^https?:\/{2}/i, "");
                url = url.replace(/\./i, "\\.");
                return ["^https?://", url].join("");
            }
            
        },
        
        //added functionality for elements
        extend:{
        
            //adds extra functionality for a text area
            textarea:function(area) {
                var element = area.get(0);
                
                //returns the selected area of the text
                area.getSelectionRange = function() {
                    return {
                        start:element.selectionStart,
                        end:element.selectionEnd
                    };
                };
                
                //sets the selection of an element
                area.setSelectionRange = function(start, end) {
                    end = end ? end : start;
                    element.setSelectionRange(start, end);
                };
                
                //inserts text into the current cursor position
                area.insertText = function(text, position) {
                    
                    //create the updated text information
                    var position = position ? position : area.getSelectionRange();
                    var current = area.val();
                    var value = [
                        current.substr(0, position.start), 
                        text,
                        current.substr(position.end, current.length - position.end)
                        ].join("");
                        
                    //then replace it and update the cursor position
                    area.val(value);
                    area.setSelectionRange(position.start + text.length);
                    
                };
                
                //gets the text selection (if any)
                area.getSelectedText = function() {
                    var position = area.getSelectionRange();
                    return position.start == position.end 
                        ? area.val() 
                        : area.val().substr(position.start, position.end - position.start);
                };
                
                //create some default event handling
                area.events = {
                    keydown:function(e) { },
                    keyup:function(e) { }
                };
                
                //handle pressing a key on the down event
                area.keydown(function(e) {
                    if (area.events.keydown(e) != null) { return; }
                    switch(e.keyCode) {
                        case shell.KEY_TAB : e.preventDefault(); area.insertText(shell.TAB_INSERT); break;
                        case shell.KEY_DELETE : if (e.ctrlKey) { area.text(""); }; break;
                        default : return;
                    }
                });
                
                //gets the word the cursor is presently over
                area.getCurrentWord = function() {
                
                    //check where to start
                    var selected = area.getSelectionRange();
                
                    //check if there is something already selected
                    if (selected.start < selected.end) { 
                        return area.getSelectedText(); 
                    }
                
                    //extract both halves
                    var value = area.val();
                    var prefix = value.substr(0, selected.start);
                    var suffix = value.substr(selected.start, value.length);
                    
                    //try and extract just the word
                    try {
                        prefix = prefix.match(/[a-z0-9_\-]*$/i, "")[0];
                        suffix = suffix.match(/^[a-z0-9_\-]*/i, "")[0];
                        return [prefix, suffix].join("");
                    }
                    catch (e) {
                        return "";
                    }
                    
                };
                
                //handle pressing a key on the up event
                area.keyup(function(e) {
                    if (area.events.keyup(e) != null) { return; }                    
                });
                
            }
        
        },
        
        //access to user settings
        settings: { },
        
        //validation methods used in different parts of the program
        validate:{
        
            //verifies this is an allowed color format
            isColor:function(color) {
                color = $.trim((color ? color : "").toString());
                return color.match(new RegExp(/^\#?[0-9a-f]{3}([0-9a-f]{3})?$/i));
            }
            
        },
        
        //formating values from different types
        format:{
        
            //attempts to return a formatted string as a color
            toColor:function(color) {
                color = $.trim((color ? color : "").toString());
                color = color.replace(/[^a-f0-9]/gi, "");
                color = ["#", color.toUpperCase()].join("");
                
                //make sure it is still valid
                return shell.validate.isColor(color) ? color : null;
            },
            
            //converts a string to an identity
            toIdentity:function(str) {
                str = $.trim((str ? str : "").toLowerCase().toString());
                str = str.replace(/[^a-z0-9_\-]/gi, "");
                return str;
            },
            
            //tries and formats a number
            toNumber:function(value) {
                value = ((value ? value : "").toString());
                value = value.replace(/[^0-9]/g, "");
                if (value.length == 0) { return null; }
                var number = parseInt(value);
                return number ? number : null;
            },
            
            //tries and formats a boolean value
            toBool:function(value) {
                try {
                    var result = value.toString().match(/true/i);
                    return (result || false);
                } 
                catch (e) {
                    return null;
                }
            },
            
        },
        
        //layer for connecting and posting messages with the background
        messaging:{
            port:null,
        
            //standard method for sending messages
            post:function(args, callback) {
                shell.messaging.port.postMessage(args, callback);
            },
        
            //handles when a message is sent
            onMessage:function(request) {
                if (!(request && request.command)) { return; }
            
                //update the settings for the window
                if (shell.util.equals(request.command, "update")) {
                    shell.extension.loadSettings(request.settings);
                    shell.ui.update();
                }
                
            },
            
            //handles when a request is made
            onRequest:function(request) {
                if (!(request && request.command)) { return; }
                
                //display the window after clicking the icon to load it
                if (shell.util.equals(request.command, "load")) {
                    shell.extension.loadSettings(request.settings);
                    shell.ui.window.showEditor();
                }
                //update settings for a window
                else if (shell.util.equals(request.command, "update")) {
                    shell.extension.loadSettings(request.settings);
                    shell.refresh();
                }
                
            },
        
            //sets up the communication layer with the background
            init:function() {
                shell.messaging.port = chrome.extension.connect({name:shell.PORT_NAME});
                shell.messaging.port.onMessage.addListener(shell.messaging.onMessage);
                chrome.extension.onRequest.addListener(shell.messaging.onRequest);
            }
        },
        
        //controls to display as part of the page
        ui:{
            
            //allows editing of custom page commands
            custom:{
            
                //creates a new designer window
                designer:function(identity) {
                    identity = shell.format.toIdentity(identity);
                    var self = this;
                    shell.util.merge(this, {
                    
                        //elements on the designer
                        container:null,
                        header:null,
                        buttons:{
                            save:null,
                            close:null,
                        },
                        fields:{
                            identity:null,
                            automatic:null,
                            expression:null,
                            script:null
                        },
                        
                        //creates the actual controls for this designer
                        build:function() {
                        
                            //the main container for the designer
                            self.container = $("<div/>").css({
                                "padding":"0",
                                "text-align":"left",
                                "font-family":"sans-serif",
                                "margin":"0",
                                "position":"absolute",
                                "top":"15px",
                                "left":"15px",
                                "-webkit-box-shadow": "0px 1px 10px black",
                                "-webkit-border-radius": "10px",
                                "border":"1px solid rgba(255,255,255,0.3)",
                                "background": ["url(", shell.RESOURCE_URL, "dialog-background.png", ") #444 top left repeat-x"].join(""),
                                "min-height":"350px",
                                "min-width":"300px"
                                })
                                .addClass(shell.ui.custom.getIdentityName(identity));
                                
                            
                            //create the header for the dialog
                            self.header = $("<div/>").css({
                                "margin":"0",
                                "padding":"5px 10px",
                                "height":"35px",
                                "cursor":"pointer",
                                "text-align":"left",
                                "font-family":"sans-serif",
                                "color":"#fff",
                                "text-shadow":"0px 1px 8px black",
                                "font-size":"13px",
                                "font-weight":"bold"
                                })
                                .text("Edit Custom Command");
                            
                            //button setup
                            var setupButton = function(image) {
                                return $("<div/>").css({
                                    "background":["url(", shell.RESOURCE_URL, image, ") top left no-repeat"].join(""),
                                    "height":"25px",
                                    "width":"25px",
                                    "position":"relative",
                                    "top":"4px",
                                    "float":"right"
                                });
                            };
                                
                            //assign the button events
                            self.buttons.save = setupButton("icon-confirm.png").click(self.handleSave);
                            self.buttons.close = setupButton("icon-close.png").click(self.handleClose);
                            
                            //create the fields that are going to be used
                            self.fields.identity = $("<input type='text' />");
                            self.fields.automatic = $("<input type='checkbox' />");
                            self.fields.expression = $("<input type='text' />");
                            
                            //create a table to hold the fields
                            //Yeah, you read that right -- A TABLE!
                            var controls = $("<table/>").attr("cellpadding", 0)
                                .attr("cellspacing", 0)
                                .width("100%");

                            //shortcut for creating rows
                            var addRow = function(text, control, title) {
                                
                                //the content itself
                                var row = $("<tr/>").attr("title", title)
                                    .appendTo(controls);                        
                                
                                //the label row
                                $("<td/>").css({
                                        "text-align":"left",
                                        "font-family":"sans-serif",
                                        "color":"#fff",
                                        "font-weight":"bold",
                                        "margin":"0",
                                        "padding":"0 10px 15px 0",
                                        "text-align":"right",
                                        "font-size":"10px",
                                        "cursor":"help",
                                        "width":"140px",
                                        "text-shadow":"0px 1px 8px black",
                                    })
                                    .text(text)
                                    .appendTo(row);
                                
                                //create the input container
                                $("<td/>")
                                    .appendTo(row)
                                    .append(control)
                                    .css({
                                        "padding":"0 15px 0 0"
                                        });
                                        
                                //general style changes
                                control.css({
                                    "background":"rgba(0,0,0,0.3)",
                                    "color":"#fff",
                                    "font-family":"monospace",
                                    "font-size":"12px"
                                });
                                
                                //style the input boxes additionally
                                if (control.attr("type") == "text") {
                                    control.css({
                                        "width":"100%",
                                        "-webkit-border-radius": "2px",
                                        "border":"1px solid rgba(255,255,255,0.3)"
                                        });
                                }
                                
                            };
                            
                            //add each row
                            addRow("Command Shortcut", self.fields.identity, "Allows you to run this command using the 'call' method or '!shortcut'");
                            addRow("URL Match RegEx", self.fields.expression, "The expression to match to automatically execute when browsing to a page.");
                            addRow("Autorun Command", self.fields.automatic, "Sets if this command runs automatically when browsing to the pages that match the expression above.");
                                    
                            //create the text editor area
                            self.fields.script = $("<textarea></textarea>").css({
                                "padding":"10px",
                                "margin":"0",
                                "width":"400px",
                                "height":"250px",
                                "border":"1px solid rgba(255,255,255,0.3)",
                                "font-family":"monospace",
                                "font-size":"12px",
                                "font-weight":"normal",
                                "background":"rgba(0,0,0,0.3)",
                                "color":"#fff",
                                "text-shadow":"0px 1px 4px black"
                                });
                                
                            //add extra functionality for the area
                            shell.extend.textarea(self.fields.script);
                                
                            //and the editor
                            var editor = $("<div/>").css({
                                "padding":"0 7px 7px 7px", 
                                "margin":"0"
                                });
                                    
                            //construct the full control
                            self.container.append(self.header);
                            self.buttons.save.appendTo(self.header);
                            self.buttons.close.prependTo(self.header);
                            self.header.prepend(self.buttons.save);
                            self.container.append(controls);
                            self.container.append(editor);
                            editor.append(self.fields.script);
                            
                            //add it to the page
                            shell.ui.window.area.append(self.container);
                            
                            //set some functionality for monitoring changes
                            self.fields.identity
                                .add(self.fields.expression)
                                .add(self.fields.automatic)
                                .add(self.fields.script)
                                .change(function() {
                                    self.buttons.close.unbind('click').click(self.handleChangeClose);
                                });
                                
                            //set a default value for the url expression
                            self.fields.expression.val(shell.util.escapeCurrentUrl());
                                
                        },
                        
                        //registers all of the events for the control
                        register:function() {
                        
                            //update the ability to drag the window
                            self.container.draggable({
                                cursor:"pointer",
                                handle:self.header,
                                opacity:0.5,
                                stop:function() { }
                            });
                        
                        },
                        
                        //handles saving the view
                        handleSave:function() {
                        
                            //try and save these settings
                            var settings = {
                                url: self.fields.expression.val(),
                                auto: self.fields.automatic.is(":checked"),
                                script: self.fields.script.val(),
                                identity: shell.format.toIdentity(self.fields.identity.val())
                            };
                            
                            //verify the important settings
                            if (settings.identity.length == 0) {
                                alert('The name of this custom command needs to be at least one character long.');
                                return;
                            }
                            
                            //apply the new settings
                            shell.extension.removeCommand(identity);
                            shell.extension.addCommand(settings);
                            shell.extension.saveSettings();
                            
                            //notify the user
                            shell.ui.alert.post({
                                message:["Settings for '", settings.identity, "' were saved!"].join(""),
                                title:"Settings Updated"
                            });
                            
                            //then close normally
                            self.handleClose();
                        
                        },
                        
                        //handles hiding the control from the view
                        handleClose:function() {
                            self.close();
                        },
                        
                        //handles if the dialog changed and save is pressed
                        handleChangeClose:function() {
                            if (confirm("Save your changes?")) {
                                self.handleSave();
                            }
                            else {
                                self.handleClose();
                            }
                        },
                        
                        //hides and removes the dialog
                        close:function() {
                            self.container.fadeOut(
                                shell.ANIMATION_SPEED, 
                                function() { self.container.remove(); }
                                );
                        },
                        
                        //loads the settings for this control
                        loadSettings:function() {
                            self.fields.identity.val(identity);
                        
                            //try and find a command setting
                            var params = jLinq.from(shell.settings.commands)
                                .equals("identity", identity)
                                .first();
                                
                            //if there are settings, populate them
                            if (params) {
                                self.fields.script.val(params.script);
                                self.fields.expression.val(params.url);
                                self.fields.automatic.attr("checked", params.auto ? "checked" : "");
                            }
                        
                        },
                        
                        //show the dialog
                        show:function() {
                            self.container.fadeOut();
                        },
                        
                        //hides the dialog box from view
                        hide:function() {
                            self.container.fadeOut();
                        },
                        
                        //destroys the dialog box
                        remove:function() {
                            self.container.remove();
                        },
                        
                        //initializes the designer
                        init:function() {
                            self.build();
                            self.register();
                            self.loadSettings();
                            
                            //allow other fade in attempts to refresh the control
                            var fade = self.container.fadeIn;
                            self.container.fadeIn = function() {
                                self.loadSettings();
                                fade();
                            };
                        }
                        
                    });
                        
                    //initializes
                    self.init();
                
                },
            
                //create a dialog (or brings it to the front)
                create:function(identity) {
                    
                    //make sure this window isn't already open
                    identity = shell.format.toIdentity(identity);
                    var window = shell.ui.custom.findWindow(identity);
                    
                    //if the window is not found, create it
                    if (window) { 
                        window.fadeIn();
                        return;
                    }
                    
                    //focus the window
                    window = new shell.ui.custom.designer(identity);
                    window.show();
                    
                },
                
                //locates a window on the page (if any)
                findWindow:function(identity) {
                    var selector = [".", shell.ui.custom.getIdentityName(identity)].join("");
                    var window = shell.ui.window.area.find(selector);
                    return window.length > 0 ? window : null;
                },
                
                //returns the class name for an identity
                getIdentityName:function(identity) {
                    return ["jsshell-custom-", identity].join("");
                }
            
            },
        
            //the actual text editor for the page
            editor:{
            
                //ui elements for the page
                dialog:null, //the actual movable window
                suggest:null, //the auto suggest box
                header:null, //the header for the dialog
                logo:null, //the jsshell logo
                container:null, //container for the text editor
                text:null, //the actual text edit box
                settings:null, //the settings button
                close:null,
                
                //updates the values on the auto suggest box
                updateSuggest:function() {
                
                    //make sure they want this
                    if (!shell.settings.showHint) { return; }
                    
                    //get the position
                    var position = shell.ui.editor.text.getSelectionRange();
                    var text = shell.ui.editor.text.val().substr(0, position.start);
                    text = text.match(/\.?\#?[a-z0-9\-_]*$/i)[0];
                    
                    //perform a lookup
                    var results = shell.extension.findAutocomplete(text);
                    if (results.length == 0) {
                        shell.ui.editor.suggest.hide();
                        return;
                    }
                        
                    //show the help
                    shell.ui.editor.suggest.empty();
                    var list = $("<ul/>").css({
                        "list-style":"none",
                        "margin":"0",
                        "padding":"10px",
                        "overflow":"hidden"
                    })
                    .appendTo(shell.ui.editor.suggest);
                    
                    //get the items to show
                    var show = jLinq.from(results).take(10);
                    
                    //add each item to the list
                    $.each(show, function(i, v) {
                        var item = shell.ui.editor.createSuggestItem(v);
                        list.append(item);
                    });
                    
                    //if there are more, say so
                    if (show.length < results.length) {
                        $("<li/>").css({
                            "font-family":"monospace",
                            "font-size":"11px",
                            "margin":"0",
                            "padding":"0",
                            "text-align":"right",
                            "padding":"3px 0",
                            "color":"#777"
                        })
                        .text([(results.length - show.length), " more..."].join(""))
                        .appendTo(list);
                    }
                    
                    //display the list
                    shell.ui.editor.suggest.show();
                
                },
                
                //creates a list item for the auto suggest window
                createSuggestItem:function(item) {
                    
                    //create the text
                    var text = $("<div/>").css({
                        "font-family":"monospace",
                        "font-size":"11px",
                        "color":"#333",
                        "margin":"0",
                        "padding":"0",
                        "text-align":"left"
                        })
                        .text(
                            (item.type == "css" ? "." : item.type == "id" ? "#" : "") +
                            item.val
                            );
                        
                    var style = $("<div/>").css({
                        "font-family":"monospace",
                        "font-size":"9px",
                        "font-style":"italics",
                        "color":shell.AUTOCOMPLETE_COLORS[item.type],
                        "float":"right",
                        "margin":"0",
                        "padding":"0"
                        })
                        .text(item.type);
                    
                    //return the list item
                    return $("<li/>").css({
                        "margin":"0",
                        "padding":"3px 0",
                        "border-bottom":"1px solid #ddd"
                        })
                        .append(style)
                        .append(text);
                    
                },
                
                //applies user styles to the editor
                applyStyle:function() {
                
                    //applies the window styles
                    shell.ui.editor.dialog.css({
                        "background-color": shell.settings.windowColor,
                        "border-color": shell.settings.windowColor
                        });
                        
                    //and the text editor styles
                    shell.ui.editor.text.css({
                        "background":shell.settings.editorColor,
                        "color":shell.settings.fontColor,
                        "border-color":shell.settings.windowColor
                        });
                
                },
                
                //displays the window for the first time
                display:function(minimized) {
                    
                    //position the element on the screen first
                    shell.ui.editor.show();
                    shell.ui.editor.text.focus();
                    
                    //get the default location
                    var position = {
                        top:shell.EDITOR_OFFSET,
                        left:$(window).width() - (shell.ui.editor.dialog.width() + shell.EDITOR_OFFSET)
                    };
                    shell.ui.editor.restore = position;
                
                    //get the position for the element
                    if (minimized) {
                        var min = shell.ui.editor.getMinimizePosition();
                        shell.ui.editor.dialog.css({
                            "top":min.top,
                            "left":min.left,
                            "opacity":0.3
                        })
                        .blur();
                        return;
                    }
                
                    //animate the display
                    shell.ui.editor.text.select();
                    shell.ui.editor.dialog
                        .css({
                            opacity:0,
                            top:position.top + shell.EDITOR_START_OFFSET,
                            left:position.left
                        })
                        .stop()
                        .animate({
                            top:position.top,
                            opacity:1
                        });
                },
                
                //minimizes the window
                moveTo:function(position) {
                    
                    //animate the display
                    shell.ui.editor.text.blur();
                    shell.ui.editor.dialog
                        .stop()
                        .animate({
                            top:position.top,
                            left:position.left,
                            opacity:shell.EDITOR_OPACITY
                        });
                
                },
                
                //rebuilds the dialog window
                build:function() {
                
                    //verify no other window exists
                    if (shell.ui.editor.dialog) {
                        shell.ui.editor.dialog.remove();
                    }
                
                    //build the rest of the control
                    shell.ui.editor.dialog = $("<div/>")
                        .clearSelf()
                        .css({
                        "width":"auto",
                        "height":"auto",
                        "padding":"0",
                        "margin":"0",
                        "position":"absolute",
                        "-webkit-box-shadow": "0px 1px 10px black",
                        "-webkit-border-radius": "10px",
                        "border": "2px solid",
                        "background": ["url(", shell.RESOURCE_URL, "dialog-background.png", ") top left repeat-x"].join(""),
                        "min-height":"150px",
                        "min-width":"200px !important"
                        });
                        
                    shell.ui.editor.suggest = $("<div/>").css({
                        "padding":"0",
                        "margin":"0",
                        "position":"absolute",
                        "-webkit-box-shadow": "0px 1px 10px black",
                        "-webkit-border-radius": "10px",
                        "border": "1px solid #999",
                        "background": "#fff",
                        "margin":"15px 0 0 -200px",
                        "width":"180px"
                        })
                        .hide();
                    
                    shell.ui.editor.header = $("<div/>").css({
                        "margin":"0",
                        "padding":"0 5px",
                        "height":"35px",
                        "cursor":"pointer"
                        })
                        .dblclick(function() {
                            if (shell.ui.editor.isMinimized()) {
                                shell.ui.editor.moveTo(shell.ui.editor.restore);
                                setTimeout(function() {
                                    shell.ui.editor.text.focus();
                                    }, (shell.ANIMATION_SPEED + 100));
                            }
                            else {
                                shell.ui.editor.moveTo(shell.ui.editor.getMinimizePosition());
                            }
                        });
                        
                    shell.ui.editor.logo = $("<div/>").css({
                        "padding":"0",
                        "margin":"0",
                        "height":"35px",
                        "width":"70px",
                        "background": ["url(", shell.RESOURCE_URL, "logo.png", ") left no-repeat"].join(""),
                        "float":"left"
                        });
                        
                    shell.ui.editor.text = $("<textarea/>")
                        .clearSelf()
                        .css({
                        "padding":"10px",
                        "margin":"0",
                        "width":"300px",
                        "height":"200px",
                        "border": "2px solid",
                        "font-family":"monospace",
                        "font-size":"12px",
                        "font-weight":"normal"
                        });
                        
                    shell.ui.editor.container = $("<div/>").css({
                        "padding":"0 7px 7px 7px", 
                        "margin":"0"
                        });
                    
                    //create a close button
                    shell.ui.editor.close = $("<a/>").css({
                        "display":"block",
                        "position":"relative",
                        "top":"4px",
                        "padding":"0",
                        "margin":"0",
                        "background": ["url(", shell.RESOURCE_URL, "icon-close.png", ") right no-repeat"].join(""),
                        "height":"25px",
                        "width":"25px",
                        "float":"right",
                        "cursor":"pointer"
                        })
                        .click(shell.ui.editor.remove);
                        
                    //show the help button
                    shell.ui.editor.settings = $("<a/>").css({
                        "display":"block",
                        "position":"relative",
                        "top":"4px",
                        "padding":"0",
                        "margin":"0",
                        "background": ["url(", shell.RESOURCE_URL, "icon-help.png", ") right no-repeat"].join(""),
                        "height":"25px",
                        "width":"25px",
                        "float":"right",
                        "cursor":"pointer"
                        })
                        .attr("href", "http://www.hugoware.net/projects/jsshell")
                        .attr("target", "_blank");
                    
                    //build the header
                    shell.ui.editor.dialog.append(shell.ui.editor.suggest);
                    shell.ui.editor.dialog.append(shell.ui.editor.header);
                    shell.ui.editor.header.append(shell.ui.editor.logo);
                    shell.ui.editor.header.append(shell.ui.editor.close);
                    shell.ui.editor.header.append(shell.ui.editor.settings);
                    
                    //and the editor area
                    shell.ui.editor.container.append(shell.ui.editor.text);
                    shell.ui.editor.dialog.append(shell.ui.editor.container);
                    
                    //register any events
                    shell.ui.editor.settings.click(shell.ui.editor.events.handleSettingsClick);
                    
                    //apply extra textarea functionality
                    shell.ui.editor.text.unbind()
                        .blur(function() { shell.ui.editor.blurDialog(); })
                        .focus(function() { shell.ui.editor.focusDialog(); });
                    shell.extend.textarea(shell.ui.editor.text);
                    shell.ui.editor.text.events.keydown = shell.ui.editor.events.handleKeyDown;
                    shell.ui.editor.text.events.keyup = shell.ui.editor.events.handleKeyUp;
                
                    //and setup the drag abilities
                    shell.ui.editor.dialog
                        .add(shell.ui.editor.suggest)
                        .draggable({
                            cursor:"pointer",
                            handle:shell.ui.editor.header,
                            opacity:0.5,
                            stop:function() {
                                shell.ui.editor.setRestorePosition();
                                shell.ui.editor.text.focus();
                            }
                        });
                    
                    //apply the style automatically
                    shell.ui.editor.applyStyle();
                    
                },
                
                //sets the position to restore to
                setRestorePosition:function() {
                    shell.ui.editor.restore = shell.ui.editor.dialog.offset()
                },
                
                //returns the location to minimize to
                getMinimizePosition:function() {
                    return {
                        top:$(window).height() - (shell.ui.editor.header.height()),
                        left:$(window).width() - (shell.ui.editor.dialog.width() + shell.EDITOR_OFFSET)
                    };
                },
                
                //determines if the window is already minimized or not
                isMinimized:function() {
                    var current = shell.ui.editor.dialog.offset();
                    var min = shell.ui.editor.getMinimizePosition();
                    return current.top == min.top && current.left == min.left;
                },
                
                //displays the dialog
                show:function() {
                    shell.ui.window.area.prepend(shell.ui.editor.dialog);
                },
                
                //hides the window from view
                hide:function() {
                    $().append(shell.ui.editor.dialog);
                },

                //kills a jsshell window
                remove:function() {
                    var dialog = shell.ui.editor.dialog;
                    dialog.stop().fadeOut(400, function() { 
                        dialog.remove();
                        shell.ui.editor.init();
                    });
                },
                
                //visual feedback a command was executed
                feedback:function() {
                    shell.ui.editor.dialog
                        .css({opacity:0.7})
                        .stop()
                        .fadeIn(shell.ANIMATION_SPEED);
                },
                
                //highlights the editor
                focusDialog:function() {
                    shell.ui.editor.dialog
                        .stop()
                        .animate({opacity:1}, shell.ANIMATION_SPEED);
                },
                
                //focuses on the editor
                blurDialog:function() {
                    shell.ui.editor.dialog
                        .stop()
                        .animate({opacity:shell.EDITOR_OPACITY}, shell.ANIMATION_SPEED);
                    shell.ui.editor.suggest
                        .stop()
                        .fadeOut(shell.ANIMATION_SPEED);
                },
                
                //try and get help about the word currently over
                tryShowHelp:function() {
                
                    //check the currently found word
                    var found = null;
                    var word = shell.ui.editor.text.getCurrentWord();
                    
                    //make sure something is even there
                    if (word.length == 0) { return; }
                    
                    //check if this exists in jQuery first
                    if (jLinq.from(shell.extension.autocomplete)
                        .equals("val", word)
                        .count() > 0) {
                        found = word;
                    }
                    //if not, check for something that starts with it
                    else if (word.length > 2) {
                        
                        //select something that matches
                        found = jLinq.from(shell.extension.autocomplete)
                            .startsWith("val", word)
                            .first();
                            
                        //if found, select the word
                        if (found) { found = found.val; }
                    }
                    
                    //if something was found, show it
                    if (found) {
                        shell.messaging.post({
                            command:"popup",
                            settings:JSON.stringify({
                                url:["http://api.jquery.com/", escape(found)].join(""),
                                name:["help__", escape(word)].join(""),
                                params:"height=500,width=1100"
                            })
                        });
                    }
                    //if not, explain why
                    else {
                        shell.ui.alert.post({
                            title:"No jQuery Command Found",
                            message:["No command named '", escape(word), "' was found within jQuery."].join("")
                        });
                    }
                    
                    
                },
                
                //find the current command and executes it
                runCommand:function() {
                
                    //get the command
                    var selection = shell.ui.editor.text.getSelectionRange();
                    var command = shell.ui.editor.text.getSelectedText();
                    
                    //hide the window so it won't be affected
                    shell.ui.window.hide();
                    
                    //run the command
                    var result = shell.extension.runCommand(command);
                    
                    //display feedback of the call
                    if (!result.success) {
                        shell.ui.alert.post({
                            message:result.error, 
                            title:"Script error"
                            });
                    }
                    
                    //restore the window
                    shell.ui.window.show();
                    shell.ui.editor.feedback();
                    
                    //restore the selection
                    shell.ui.editor.text.focus();
                    shell.ui.editor.text.setSelectionRange(selection.start, selection.end);
                    
                },
                
                //events from the user interface
                events:{
                
                    //when a key is pressed down
                    handleKeyDown:function(e) {
                        switch(e.keyCode) {
                            case shell.KEY_DOWN_ARROW : shell.ui.editor.actions.handleDown(e); break;
                            case shell.KEY_ENTER : shell.ui.editor.actions.handleEnter(e); break;
                            case shell.KEY_F1 : shell.ui.editor.actions.handleHelp(e); break;
                            case shell.KEY_QUESTION : shell.ui.editor.actions.handleHelp(e); break;
                            default : return;
                        }
                    },
                    
                    //when a key is released
                    handleKeyUp:function(e) {
                        if (shell.ui.editor.suggestDelay) { window.clearTimeout(shell.ui.editor.suggestDelay); }
                        shell.ui.editor.suggestDelay = window.setTimeout(shell.ui.editor.updateSuggest, 100);
                    }
                    
                },
                
                //actions related to events
                actions:{
                
                    //when the user presses the down key
                    handleDown:function(e) {
                        if (e.ctrlKey) { 
                            shell.ui.editor.minimize();
                        }
                    },
                    
                    //when the user presses enter
                    handleEnter:function(e) {
                        if (e.ctrlKey) { 
                            shell.ui.editor.runCommand();
                        }
                    },
                    
                    //when the user presses enter
                    handleHelp:function(e) {
                        if (e.ctrlKey) { 
                            e.preventDefault();
                            shell.ui.editor.tryShowHelp();
                        }
                    }
                    
                },
                
                //setup functionality for the dialog
                init:function() {
                    shell.ui.editor.build();
                }
            
            },
            
            //displays an alert box in the bottom corner
            alert:{
            
                //ui elements
                container:null, //the container for messages
                list:null, //holds the messages to display
                
                //posts a small message to the bottom of the screen and then fades it away
                post:function(params) {
                    if (params == null || !shell.settings.displayNotes) { return; }
                
                    //create the message to display
                    var message = shell.ui.alert.createMessage(params);
                    if (message == null) { return; }
                    
                    //add it to the window
                    shell.ui.alert.list.prepend(message);
                    
                    //animate the message into the screen
                    message.fadeIn();
                        
                    //and update the sizing
                    setTimeout(shell.ui.alert.update, 1);
                    
                },
                
                //creates the message container
                createMessage:function(params) {
                
                    //make sure there is a message
                    if (params.message) {
                        params.message = params.message.toString();
                        if (params.message.length == 0) { return; }
                    }
                    else {
                        return;
                    }
                    
                    //get the duration as a number
                    if (params.duration) {
                        params.duration = parseInt(0, params.duration.toString().replace(/[^0-9]/g, ""));
                        if (params.duration == 0) { return; }
                    }
                    else {
                        params.duration = shell.DEFAULT_NOTE_DURATION;
                    }
                    
                    //check for a title
                    if (params.title) {
                        params.title = params.title.toString();
                    }
                    
                    //create a message item
                    var message = $("<div/>").css({
                        "width": "230px",
                        "text-shadow": "0px 1px 10px black",
                        "-webkit-box-shadow": "0px 1px 10px black",
                        "-webkit-border-radius": "10px",
                        "border": "1px solid rgba(0,0,0,0.2)",
                        "background": "rgba(0,0,0,0.7)",
                        "color":"#fff",
                        "position":"relative",
                        "margin":"10px 0 15px 10px"
                        });
                        
                    var container = $("<div/>")
                        .css({"padding":"10px"})
                        .appendTo(message);
                        
                    //if there is a title, add it now
                    if (params.title != null) {
                        $("<div/>").css({
                            "font-weight":"bold",
                            "font-size":"13px",
                            "font-family":"sans-serif",
                            "padding":"0 0 5px 0",
                            "margin":"0"
                        })
                        .text(params.title)
                        .appendTo(container);
                    }
                    
                    //append the message
                    $("<div/>").css({
                        "font-size":"11px",
                        "font-family":"sans-serif",
                        "font-weight":"normal",
                        "padding":"0",
                        "margin":"0"
                        })
                        .html(params.message)
                        .appendTo(container);
                        
                    //create a close button
                    var close = $("<div/>")
                        .css({
                            "margin":"0 -2px 0 0",
                            "padding":"0",
                            "height":"25px",
                            "width":"25px",
                            "float":"right",
                            "background":["url(", shell.RESOURCE_URL, "icon-close.png", ") top right no-repeat"].join(""),
                            "cursor":"pointer",
                            "position":"relative",
                            "top":"3px",
                            "left":"-4px",
                            "z-index":"1"
                        })
                        .prependTo(message);
                        
                    //perform some styling for links
                    message.find("a").css({"color":"#ff0"})
                        .attr("target", "_blank");
                    
                    //create a simple removal function
                    var remove = function() {
                    
                        //queue the update actions
                        setTimeout(shell.ui.alert.update, 1);
                    
                        //check if this can be removed still
                        if (message == null) { return; }
                        
                        //since it is okay to hide, do it now
                        message.fadeOut(
                            shell.ANIMATION_SPEED,
                            function() { message.remove(); }
                            );
                    };
                    
                    //create the handling of removal
                    message.remaining = params.duration;
                    var checkForRemoval = window.setInterval(function() {
                        
                        //update the alert list
                        shell.ui.alert.update();
                        
                        //check if this has been removed
                        if (message == null) { 
                            if (checkForRemoval) { window.clearInterval(checkForRemoval); }
                            return; 
                        }
                        
                        //if the mouse is over this, reset the duration
                        if (message.over) { message.remaining = params.duration; }
                        
                        //if not, update the remaining time
                        message.remaining -= shell.NOTE_INTERVAL;
                        
                        //finally, check one last time to remove it
                        if (message.remaining <= 0) {
                            window.clearInterval(checkForRemoval);
                            remove();
                        }
                    
                    }, shell.NOTE_INTERVAL);
                    
                    //set some handlers to watch for mouse overs
                    message.mouseover(function() { message.over = true; })
                        .mouseout(function() { message.over = false; });
                    
                    //also assign "close" to remove the script as well
                    close.click(function() {
                        if (checkForRemoval) { window.clearInterval(checkForRemoval); }
                        remove();
                    });
                        
                    //return the message
                    return message;
                },
                
                //builds the container for the messages
                build:function() {
                
                    //create the positioning for the bottom
                    shell.ui.alert.container = $("<div/>").css({
                        "position":"fixed",
                        "top":"100%",
                        "height":0
                    })
                    .prependTo(shell.ui.window.area);
                    
                    //create the container for the messages
                    shell.ui.alert.list = $("<div/>").css({
                        "position":"relative"
                        })
                        .prependTo(shell.ui.alert.container);
                },
                
                //update the size of the list
                update:function() {
                    shell.ui.alert.list.css({"margin-top":["-", (shell.ui.alert.list.height() + shell.NOTE_OFFSET), "px"].join("")});
                },
                
                //setup for the message container
                init:function() {
                    shell.ui.alert.build();
                }
            
            },
            
            //the base window for the screen
            window:{
            
                //creates the actual window for the jsshell
                area:$("<div/>").css({
                    position:"fixed",
                    top:0,
                    left:0,
                    height:0,
                    width:0,
                    "z-index":9999999
                    }),
                
                //displays the editor
                show:function() {
                    $(document.body).prepend(shell.ui.window.area);
                },
                
                //removes the window from view
                hide:function() {
                    $().append(shell.ui.window.area);
                },
                
                //handles displaying the editor                
                showEditor:function(minimizeAtStart) {
                    shell.ui.window.show();
                    shell.ui.editor.display(minimizeAtStart);
                },
                
                //clears existing window
                clear:function() {
                    shell.ui.window.area.remove();
                }
                
            },
            
            //setup any UI 
            init:function() {
                shell.ui.editor.init();
                shell.ui.window.show();
                shell.ui.alert.init();
                shell.extension.updateAutocomplete();
            },
            
            //perform updates related to settings changes
            update:function() {
                shell.ui.editor.applyStyle();
            }
            
        },
        
        //persising custom settings
        data:{
            
            //tries to save data
            load:function(key, silent) {
        
                //check the key
                key = $.trim((key ? key : "").toString()).toLowerCase();
                if (key.length == 0) {
                    shell.ui.alert.post({
                        title:"Missing Key",
                        message:"You must provide a key for the data you are trying to access."
                    });
                    return;
                }
                
                //check if this even exists
                var existing = shell.settings.data[key];
                if (existing) {
                    return JSON.parse(existing);
                }
                else {
                    if (!silent) {
                        shell.ui.alert.post({
                            title:"No Data Found",
                            message:["No settings with the name '", shell.util.encode(key), "' were found."].join("")
                        });
                    }
                    return null;
                }
                
            },
            
            //tries to load data
            save:function(key, obj, silent) {
            
                //check the key
                key = $.trim((key ? key : "").toString()).toLowerCase();
                if (key.length == 0) {
                    shell.ui.alert.post({
                        title:"Missing Key",
                        message:"You must provide a key for the data you are trying to access."
                    });
                    return;
                }
            
                //set the values
                shell.settings.data[key] = JSON.stringify(obj);
                
                //post a message to tell the user
                if (!silent) {
                    shell.ui.alert.post({
                        title:"Data Updated",
                        message:["The data for '", shell.util.encode(key), "' was updated."].join("")
                    });
                }
                
                //save the changes
                shell.extension.saveSettings();
                
            },
            
            //loads an object to modify right away
            use:function(key, delegate) {
                shell.data.edit({ silent : true, save: false });
            },
            
            //loads then allows modifications to data
            edit:function(key, delegate, options) {
                options = options ? options : { silent: true, save: false };
                
                //try and load the data
                var data = shell.data.load(key, options.silent);
                if (!data) { data = {}; }
                
                //perform the work
                data = delegate(data);
                
                //quit if this isn't going to save anything
                if (!options.save) { return; }
                
                //Don't let them accidentally delete the data
                if (data == null) { 
                    shell.ui.alert.post({
                        title:"Data Not Saved",
                        message:"Your data was not saved because the delegate returned a null. You must return the object you are modifying."
                    });
                    return;
                }
                
                //save the final data
                shell.data.save(key, data, options.silent);
            
            }
        
        },
        
        //prebuilt commands
        builtin:{
        
            //calls the save function manually
            save:function() {
                try {
                    shell.extension.saveSettings();
                    shell.ui.alert.post({
                        title:"Settings Saved",
                        message:"Settings were manually saved."
                    });
                }
                catch (e) {
                    shell.ui.alert.post({
                        title:"Problem Saving Settings",
                        message:"Unable to save your settings. Exception: " + e
                    });
                }
            },
            
            //removes the editor window
            kill:function() {
                shell.ui.editor.remove();
            },
            
            //removes the editor window
            close:function() {
                shell.ui.editor.remove();
            },
            
            //removes the editor window
            remove:function() {
                shell.ui.editor.remove();
            },
        
            //resets all settings for the editor
            reset:function() {
                if (!confirm("Are you sure you want to completely reset your settings?")) { return; }
                chrome.extension.sendRequest(
                    { command: "reset" },
                    function(settings) {
                        shell.extension.loadSettings(settings);
                        shell.ui.window.clear();
                        shell.ui.init();
                    });
            },
        
            //clears styles from the page
            nostyle:function() {
                $("link").add("style").remove();
                $("*").attr("style", "");
                
                var retain = (function(items) {
                    var list = []
                    for (var item in items) {
                        list.push(new RegExp(["^", items[item], "$"].join(""), "gi"));
                    }
                    return list;
                })([ "type", "value", "id", "name", "href", "src" ]);

                var keep = function(val) {
                    val = (val ? val : "").toString();
                    for(var item in retain) {
                        if (val.match(retain[item])) { return true; }
                    }
                }

                $("*").each(function(i,v) {
                    var element = $(v);
                    for(var item in v.attributes) {
                        var name = v.attributes[item].name;
                        if (keep(name)) { continue; }
                        element.removeAttr(name);
                    }
                });

                $("center").each(function(i,v) {
                    $(v).children().insertAfter($(v));
                    $(v).remove();

                });
                
                shell.ui.alert.post({
                    message:"Removed <em>style</em> and <em>link</em> tags and all <em>style</em> attributes.",
                    title:"Styles removed"
                });
            },
            
            //runs the command to force flash into the background
            flash:function() {
                $("object")
                    .append($("<param name='wmode' value='opaque' />"))
                    .add("embed")
                    .attr("wmode", "opaque")
                    .css({
                        "position":"relative",
                        "z-index":0
                    });
                shell.ui.alert.post({
                    message:"Flash objects should now be below the editor window.",
                    title:"Updated Flash"
                });
            }
        
        },
            
        //actual actions for the 
        extension:{
        
            //checks if an auto command should be run immediately
            checkForAutoCommand:function() {
                if (!shell.settings.allowAuto) { return; }
            
                //check for commands that meet the requirements
                jLinq.from(shell.settings.commands)
                    .is("auto")
                    .each(function(rec) {
                        if (!window.location.toString().match(new RegExp(rec.url, "gi"))) { return; }
                        shell.extension.runCommand(rec.script);
                    });
                    
            },
        
            //handle loading and saving settings
            saveSettings:function() {
                shell.messaging.post({
                    command:"save",
                    settings:JSON.stringify(shell.settings)
                });
            },
            
            //gets the current settings for the shell
            loadSettings:function(settings) {
                shell.settings = settings;
            },
        
            //content available for the auto complete box
            autocomplete:[],
        
            //performs and eval and executes a command
            runCommand:function(command) {
                
                //check for a custom command
                var result = shell.extension.tryExecuteCustomCommand(command);
            
                //check for any built in commands first
                if (!result) {
                    result = shell.extension.tryExecuteBuiltInCommand(command);
                }
                
                //performs actual evaluation of commands
                if (!result) {
                    result = shell.extension.evalCommand(command);
                }
                
                //and return the result
                return result;
            
            },
            
            //performs actual evaluation of commands
            evalCommand:function(command) {
                
                //perform the eval
                try {
                    ____execute__jsshell___script(command);
                    return {
                        success:true
                    };
                }
                catch(e) {
                    return {
                        success:false,
                        error:e.toString()
                    };
                }
                
                //update the autocomplete list
                shell.extension.updateAutocomplete();
                
            },
            
            //tries to run a command by a user
            tryExecuteCustomCommand:function(command) {
            
                //search for a matching command
                command = command.replace(/\!/gi, "");
                var custom = jLinq.from(shell.settings.commands)
                    .equals("identity", command)
                    .select(function(rec) {
                        return rec.script;
                    });
                    
                //if there are commands, extract the methods
                if (custom.length > 0) {
                    return shell.extension.evalCommand(custom.join(";;"));
                }
                
            },
            
            //checks for a built in command to run
            tryExecuteBuiltInCommand:function(command) {
            
                //format the command first
                command = command.replace(/^!{1}/, "");
                
                //check if it exists
                if (!shell.builtin[command]) { return null; }
                
                //since it exists, run it now
                try {
                    shell.builtin[command]();
                    return {
                        success:true
                    };
                }
                catch(e) {
                    return {
                        success:false,
                        error:e.toString()
                    };
                }
            
            },
            
            //removes a command from the settings
            removeCommand:function(identity) {
                identity = shell.format.toIdentity(identity);
                var commands = [];
                for(var item in shell.settings.commands) {
                    var command = shell.settings.commands[item];
                    if (command.identity && shell.util.equals(command.identity, identity)) { continue; }
                    commands.push(command);
                }
                shell.settings.commands = commands;
            },
            
            //adds a new command to the settings
            addCommand:function(settings) {
                shell.extension.removeCommand(settings.identity);
                shell.settings.commands.push(settings);
            },
            
            //holds a cached jlinq query
            queryContainer:null,
            
            //updates the information about the content on the page
            updateAutocomplete:function() {
                try {
                
                    //get the ids and elements
                    var ids = jLinq.$("*[id]").distinct("attr('id')");
                    var elements = jLinq.$("*").distinct("get(0).tagName");
                    
                    //get the classes
                    var classes = [];
                    jLinq.$("*[class]").each(function(rec) {
                        $.each(rec.attr("class").split(/\s/g), function(i, v) { 
                            if ($.trim(v).length == 0) { return; }
                            classes.push(v); 
                        });
                    })    
                    classes = jLinq.from(classes).distinct();
                    
                    //merge the lists together
                    var list = [];
                    $.each(ids, function(i, v) { list.push({ type:"id", val:v }); });
                    $.each(classes, function(i, v) { list.push({ type:"css", val:v }); });
                    $.each(elements, function(i, v) { list.push({ type:"element", val:v }); });
                    
                    //get a list of the jQuery functions
                    for(var item in $()) { list.push({ type:"jQuery", val:item }); }
                    for(var item in $) { list.push({ type:"jQuery", val:item }); }
                    for(var item in jLinq.from([{}])) { list.push({ type:"jLinq", val:item }); }
                    for(var item in jLinq) { list.push({ type:"jLinq", val:item }); }
                    list.push({ type:"jLinq", val:"jLinq" });
                    
                    //get the commands for the shell
                    for(var item in extra) { list.push({ type:"jsshell", val:item }); }
                    
                    //order the items
                    shell.extension.autocomplete = jLinq.from(list).orderBy("val").select();
                    
                }
                //no auto complete available
                catch (e) {
                    shell.extension.updateAutocomplete = function() { };
                    shell.ui.alert.post({
                        title:"AutoComplete Unavailable",
                        message:"Could not update autocomplete list. Exception: " + e
                    });
                }
                
            },
            
            //searches for elements in the dialog
            findAutocomplete:function(text) {
            
                //format the string
                text = $.trim((text ? text : "").toString());
                if (text == null || text.length == 0) { return []; }
                
                //check for specific types
                var onlyClass = text.match(/^\.$/);
                var onlyId = text.match(/^\#$/);
                text = text.replace(/^(\.|\#)*/, "");
                
                //find the matches 
                var query = jLinq.from(shell.extension.autocomplete);
                
                //search for names (if needed)
                if (text.length > 0) { query = query.startsWith("val", text); }
                    
                //check for specific types
                if (onlyClass) { query = query.equals("type", "css"); }
                if (onlyId) { query = query.equals("type", "id"); }
                
                //return the final records
                return query.select();
            
            }
        
        },
        
        //setup work
        init:function() {
        
            //setup the command
            shell.messaging.init();
            
            //then check for startup scripts
            chrome.extension.sendRequest(
                { command: "connect" },
                function(settings) {
                    //load the settings and test for auto commands
                    shell.extension.loadSettings(settings);
                    
                    //make sure if this should run on this window
                    if (shell.settings.onlyTop && !window.top) { return; }
                    
                    //check for a command to run immediately
                    shell.extension.checkForAutoCommand();
                    
                    //initalize
                    shell.ui.init();
                    
                    //auto show the window if needed
                    setTimeout(function() {
                        if (shell.settings.autoShow) { 
                            shell.ui.window.showEditor(true);
                        }
                    }, 100);
                });
                
        },
        
        //resets a shell with certain settings
        refresh:function() {
            shell.ui.init();
        }
        
    };

    //create exposed functionality
    var extra = {
    
        //fun commands
        debug:function() {
            if (shell.ui.alert.container) { shell.ui.alert.container.remove(); }
            jsshell.call("nostyle");
            $(document.body).empty().css({
                "background":"#000", 
                "color":"#0f0",
                "font-family":"monospace",
                "padding":"15px"
                });
            
            //shortcut method
            var message = function(time, message) {
                setTimeout(function() { $(document.body).append($("<div/>").text(message)); }, time);
            };
            
            //and then the messages to show
            message(10, "Preparing window...");
            message(1000, "Verifying settings...");
            message(1500, "Backing up settings...");
            message(3000, "Settings packed...");
            message(3500, "Checking server access...");
            message(4500, "Checking for backup server...");
            message(6000, "Performing handshake...");
            message(7000, "Requesting content...");
            message(7500, "Rendering...");
            message(8000, "Validating render result...");
            message(8500, "Preparing to display...");
            setTimeout(function() {
                $(document.body).empty()
                    .append($('<div style="position:fixed;top:0;left:0;height:100%;width:100%;" ><iframe src="http://www.youtube.com/watch_popup?v=oHg5SJYRHA0&pop_ads=0" width="100%" height="100%" border="0" ></iframe>'));
            }, 10000);
        
        },

        //calls a shortcut method
        call:function(command) {
            return shell.extension.runCommand(command);
        },
        
        //displays a note
        note:function(params) {
        
            //make sure this is okay
            if (!(params && params.message && params.message.substr)) {
                shell.ui.alert.post({
                    title:"Could not call jsshell.note",
                    message:"Method requires object with message <em>(string)</em> and optional title <em>(string)</em> or duration <em>(int)</em>"
                });
            }
            
            //perform the post
            shell.ui.alert.post(params);
        },
        
        //navigates to a new window
        go:function(url) {
        
            //format the address
            url = (url ? url : "").toString();
            if (url.length == 0) { return; }
            
            //check for HTTP
            if (!url.match(/^https?:\/{2}/i)) {
                url = ["http://", url].join("");
            }
        
            //tell the user
            shell.ui.alert.post({
                title:"Navigating",
                message:["Changing page to ", shell.util.encode(url), "..."].join("")
            });
            
            //perform the change
            setTimeout(function() {
                window.open(url, "_self");
            }, 1);
        },
        
        //sets the value for a setting
        setting:function(key, value) {
            key = $.trim((key ? key : "").toString());
            
            //hold if the setting was change
            var post = {
                message:["No setting with the name '", key, "' was found."].join(""),
                title:"No Settings Changed",
                found:false
            };
        
            //check if this is a color update
            if (key.match(/^allowAuto$/i)) {
                var change = shell.format.toBool(value);
                if (change == null) {
                    post.message = "The setting 'autoAllow' requires a boolean value.";
                }
                else {
                    shell.settings.allowAuto = change;
                    post.message = ["Setting '", key, "' was changed to ", change.toString()].join("");
                    post.found = true;
                }
            }
            else if (key.match(/^autoDelay$/i)) {
                var change = shell.format.toNumber(value);
                if (change == null) {
                    post.message = "The value for 'autoDelay' should be a number.";
                }
                else if (change < 0) {
                    post.message = "The value for 'autoDelay' should be greater than 0.";
                }
                else {
                    shell.settings.autoDelay = change;
                    post.message = ["Setting '", key, "' was changed to ", change.toString()].join("");
                    post.found = true;
                }
            }
            else if (key.match(/^displayNotes$/i)) {
                var change = shell.format.toBool(value);
                if (change == null) {
                    post.message = "The setting 'displayNotes' requires a boolean value.";
                }
                else {
                    shell.settings.displayNotes = change;
                    post.message = ["Setting '", key, "' was changed to ", change.toString()].join("");
                    post.found = true;
                }
            }
            //display auto complete or not
            else if (key.match(/^showHint$/i)) {
                var change = shell.format.toBool(value);
                if (change == null) {
                    post.message = "The setting 'showHint' requires a boolean value.";
                }
                else {
                    shell.settings.showHint = change;
                    post.message = ["Setting '", key, "' was changed to ", change.toString()].join("");
                    post.found = true;
                }
            }
            //load the dialog automatically
            else if (key.match(/^autoShow$/i)) {
                var change = shell.format.toBool(value);
                if (change == null) {
                    post.message = "The setting 'autoShow' requires a boolean value.";
                }
                else {
                    shell.settings.autoShow = change;
                    post.message = ["Setting '", key, "' was changed to ", change.toString()].join("");
                    post.found = true;
                }
            }
            //load only on top window
            else if (key.match(/^onlyTop$/i)) {
                var change = shell.format.toBool(value);
                if (change == null) {
                    post.message = "The setting 'onlyTop' requires a boolean value.";
                }
                else {
                    shell.settings.onlyTop = change;
                    post.message = ["Setting '", key, "' was changed to ", change.toString()].join("");
                    post.found = true;
                }
            }
            
            //save and update the settings
            if (post.found) {
                shell.extension.saveSettings();
                shell.ui.update();
                post.title = "Settings Updated"; 
            }
            shell.ui.alert.post(post);
        
        },
        
        //updates a settings value
        color:function(key, color) {
        
            //make sure the value is okay
            color = $.trim((color ? color : "").toString());
            key = $.trim((key ? key : "").toString());
            if (color == "" || key == "") {
                shell.ui.alert.post({
                    title:"Error updating setting",
                    message:"You must provide a setting key and a color!"
                    });
                return;
            }
            
            //expression to validate colors
            color = shell.format.toColor(color);
            if (color == null) {
                shell.ui.alert.post({
                    title:"Invalid color format",
                    message:"Colors must be in the format <code>#XXX</code> or <code>#XXXXXX</code>"
                });
                return;
            }
            
            //check if this is a color update
            if (key.match(/^dialog$/i)) {
                shell.settings.windowColor = color;
            }
            else if (key.match(/^editor$/i)) {
                shell.settings.editorColor = color;
            }
            else if (key.match(/^font$/i)) {
                shell.settings.fontColor = color;
            }
            else {
                shell.ui.alert.post({
                    title:"Invalid color key",
                    message:"Valid color settings are <code>dialog</code>, <code>editor</code> and <code>font</code>."
                });
                return;
            }
            
            //save and update the settings
            shell.extension.saveSettings();
            shell.ui.update();
        
        },
        
        //persising custom settings
        data:{
            
            //tries to save data
            load:function(key) {
                return shell.data.load(key);
            },
            
            //tries to load data
            save:function(key, obj, silent) {
                shell.data.save(key, obj);
            },
            
            //displays a list of all available data sources
            list:function() {
            
                //select all of the commands
                var items = [];
                for(var item in shell.settings.data) {
                    items.push(item);
                }
                var commands = items.join("<br />");
                    
                //make sure something was found
                if (commands == "") {
                    commands = "No custom data sources were found!<br /><em>Use jsshell.data.save('key, object) to create one!</em>";
                }
                    
                //show a list of the commands
                shell.ui.alert.post({
                    title:"Data Sources",
                    message:commands
                });
            
            },
            
            //loads then allows modifications to data
            edit:function(key, delegate) {
                shell.data.edit(key, delegate, { silent: true, save: true });
            },
                        
            //loads then allows modifications to data
            use:function(key, delegate) {
                shell.data.edit(key, delegate, { silent: true, save: false });
            }
        
        },
        
        //allows editing a custom shell window
        custom:{
        
            //shows a dialog to edit a custom command
            edit:function(identity) {
                identity = shell.format.toIdentity(identity);
                if (identity.length > 1) { 
                    shell.ui.custom.create(identity);
                }
                else {
                    shell.ui.alert.post({
                        title:"Bad Command Name",
                        message:"Command names must contain only letters, numbers, underscores or hyphens."
                    });
                }
            },
            
            //deletes a custom command from the list
            remove:function(identity) {
                identity = shell.format.toIdentity(identity);
                var start = shell.settings.commands.length;
                shell.extension.removeCommand(identity.toString());
                if (shell.settings.commands.length < start) {
                    shell.ui.alert.post({
                        title:"Command Removed",
                        message:["Command '", identity, "' was removed."].join("")
                    });
                }
                else {
                    shell.ui.alert.post({
                        title:"No Command Removed",
                        message:["No command named '", identity, "' was found to remove."].join("")
                    });
                }
            },
            
            //lists all custom commands
            list:function() {
            
                //select all of the commands
                var commands = jLinq.from(shell.settings.commands)
                    .orderBy("identity")
                    .select(function(rec) {
                        return rec.identity
                    })
                    .join("<br />");
                    
                //make sure something was found
                if (commands == "") {
                    commands = "No custom commands were found!<br /><em>Use jsshell.custom.edit('commandName') to create one!</em>";
                }
                    
                //show a list of the commands
                shell.ui.alert.post({
                    title:"Custom Commands",
                    message:commands
                });
            
            }
            
        },
            
        //export a list of settings 
        exportSettings:function() {
            var str = JSON.stringify(shell.settings);
            str = str.replace(/\\/g, "\\\\");
            str = str.replace(/"/g, "\\\"");
            str = str.replace(/'/g, "\\'");
            return str;
        },
        
        //imports settings into the editor
        importSettings:function(str) {
            shell.settings = JSON.parse(str);
            try {
                shell.extension.saveSettings();
                shell.init();
            }
            catch(e) {
                alert(["Could not import settings: ", e.toString()].join(""));
            }
            
        }
        
    };
    
    //merge the extra functions
    jsshell = shell.util.merge(jsshell, extra);
    js = shell.util.merge(js, extra);
    
    //finally, finish the setup
    shell.init();
    
})();