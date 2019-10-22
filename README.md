# VizTalk
Talk to your Tableau Viz!

The recommended way of deploying the prototype is by using a local webserver running on the client device. While developing this implementation, installing and using node.js for its integrated webserver worked reliably. Please note, that the current http-server implementation in node.js contains a major bug, downgrading or re-installing from version 0.10 to 0.9 would be necessary, as mentioned in several guides (For example, refer to this solution: https://stackoverflow.com/a/56990253)

The repository can be cloned/downloaded/forked and used by anyone who wants to try out speech recognition in visualizations. Apart of making this repository publicly available, I made the webapp available on Github Pages (Accessible under: https://ch-za.github.io/VizTalk/), so it can be used without deploying it on a local webserver as well.

Please note, that the user client needs to access the webserver by using the Chrome Browser (or Microsoft Edge Beta based on Chromium) for VizTalk to operate properly, other major browsers like Firefox or Opera aren't implementing the SpeechRecognition interface and won't enable user voice input as of writing this guide.
