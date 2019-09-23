function stopAnnyang() {
    annyang.abort();
    $("voicecontent").remove();
    $("#stoptalk").html("Not listening");
    $("#ptt").html("Push to talk!");
    $("#ptt").prop("disabled", false);
    $("#stoptalk").prop("disabled", true);
}

// use function scope for stability
(function() {

    // wait for HTML document to be loaded completely before executing the JS content
    $(document).ready(function() {

        // annyang debug mode for console logs
        annyang.debug(true);

        // Voice recognition start/end console log
        annyang.addCallback('start', function() {console.log('started listening');});
        annyang.addCallback('end', function() {console.log('stopped listening');});

        // Event handler for voice recognition results. Add recognized text to HTML document.
        annyang.addCallback('resultMatch', function(userSaid, commandText, phrases) {
            console.log(userSaid); // sample output: 'hello'
            console.log(commandText); // sample output: 'hello (there)'
            console.log(phrases); // sample output: ['hello', 'halo', 'yellow', 'polo', 'hello kitty']
            if($("#resulttext")) {
                $("#resulttext").remove();
            }
            $("#maincontainer").append("<div id='resulttext' class='row justify-content-md-center'><p class='text-center text-success'>MATCH - You said:<br>" + userSaid + "</p></div>");
        });
        annyang.addCallback('resultNoMatch', function(result) {
            if($("#resulttext")) {
                $("#resulttext").remove();
            }
            $("#maincontainer").append("<div id='resulttext' class='row justify-content-md-center'><p class='text-center text-warning'>NO MATCH - You maybe said:<br>" + result + "</p></div>");
        });

        // Start listening Button
        $("#ptt").click(function() {
            annyang.start();
            $("voicecontent").remove();
            $("#ptt").html("Listening...");
            $("#stoptalk").html("Stop listening!");
            $("#ptt").prop("disabled", true);
            $("#stoptalk").prop("disabled", false);
        });

        // Stop listening Button
        $("#stoptalk").click(stopAnnyang);
    });
})();