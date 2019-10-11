/**
 * use function scope for stability
 */
(function() {
    var viz, workbook, activeSheet, publishedSheets;

    var fuseoptions = {
        shouldSort: true,
        threshold: 0.6,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        minMatchCharLength: 1,
    };
    /**
     * wait for HTML document to be loaded completely before executing the JS content
     */
    $(document).ready(function() {

        /**
         * essentially "kickstarting" the script
         */
        initializeViz();

        /**
         * Assign workbook/sheet variables and initialize annyang by building its commands
         */
        function initializeViz() {
            var container = document.getElementById("vizcontainer");
            var url = "https://public.tableau.com/views/WorldIndicators/GDPpercapita";
            var options = {
                width: container.offsetWidth,
                height: container.offsetHeight,
                onFirstInteractive: function () {
                    workbook = viz.getWorkbook();
                    activeSheet = workbook.getActiveSheet();
                    publishedSheets = workbook.getPublishedSheetsInfo();
                    annyangInit();
                    var options = {
                        maxRows: 0, // 0 is returning all rows
                        ignoreAliases: false,
                        ignoreSelection: true
                    };
                    //activeSheet.getUnderlyingDataAsync(options).then(function(d) {dataFunc(d)});
                    //activeSheet.getSummaryDataAsync(options).then(function(t) {sumFunc(t)});
                    //getFilters(activeSheet);
                    buildSelectFilterCountryCmd();
                    buildSelectFilterRegionCmd();
                    buildFuzzyCmds();
                }
            };
            viz = new tableau.Viz(container, url, options);
        }

        /**
         * initial annyang setup with basic commands for controlling the viz
         */
        function annyangInit() {
            var cmds = {
                'hello': function() { alert('Hello Vizmaster!'); },
                'activate (sheet) *name': activateSheet,
                'clear selection': clearSelection,
                'clear filter :filter': clearFilter,
                ':type filter by Year :year': yearFilter,
                'reset workbook': resetWkbk,
                'disable': stopAnnyang,
                'apply range filter to GDP between :min and :max': applyGDPRangeFilter
            };
            var cmdKeys = Object.keys(cmds);
            var cmdString = cmdKeys.join("<br>");
            annyang.addCommands(cmds);
            $("#cmdTarget").append("<h2 id='available'>Available commands:</h2>" +
                "<p>" + cmdString + "</p><p>Use '-1' in range filter for no min/max.<br>Use '-1' for both for clearing range filter.</p>");
        }

        /**
         * helper function for data log
         * @param data - underlying data from Tableau
         */
        function dataFunc(data) {
            console.log(data.getData());
            console.log(data.getColumns());
        }

        /**
         * helper function for data log
         * @param sum - underlying summary data from Tableau
         */
        function sumFunc(sum) {
            console.log(sum.getData());
            console.log(sum.getColumns());
        }

        function getFilters(sheet) {
            sheet.getFiltersAsync().then(function(filters) {
                // Iterate through the filters retrieving properties
                for (filter of filters) {
                    console.log(filter.getFieldName());
                    console.log(filter.getFilterType());
                }
            });
        }

        /**
         * Activate a certain worksheet.
         * Check if called sheet is within the workbook and adapt to case-sensitivity.
         * @param name - name of the worksheet to be activated
         */
        function activateSheet(name) {
            var sheetHelp;
            for (var i = 0; i < publishedSheets.length; i++) {
                sheetHelp = publishedSheets[i].getName();
                if (sheetHelp.toLowerCase() === name.toLowerCase()) {
                    if (workbook) {
                        workbook.activateSheetAsync(sheetHelp).then(function () {
                            activeSheet = workbook.getActiveSheet();
                            console.log(activeSheet);
                        });
                        break;
                    }
                }
            }
        }

        /**
         * Clear all selections done on the worksheet
         */
        function clearSelection() {
            activeSheet.clearSelectedMarksAsync();
        }

        /**
         * Clear specific filter done on the worksheet
         * @param filter - filter to be cleared
         */
        function clearFilter(filter) {
            activeSheet.clearFilterAsync(filter);
        }

        /**
         * Reset Tableau workbook to its initial state
         */
        function resetWkbk() {
            workbook.revertAllAsync();
        }

        /**
         * Filter worksheet by year.
         * @param type - type of filter to be used
         * @param year - specific year for filter
         */
        function yearFilter(type, year) {
            var uppercase = type.toUpperCase();
            switch(uppercase) {
                case "ADD":
                    activeSheet.applyFilterAsync(
                        "JAHR(Date (year))",
                        year,
                        tableau.FilterUpdateType.ADD);
                    break;
                case "REMOVE":
                    activeSheet.applyFilterAsync(
                        "JAHR(Date (year))",
                        year,
                        tableau.FilterUpdateType.REMOVE);
                    break;
                case "REPLACE":
                    activeSheet.applyFilterAsync(
                        "JAHR(Date (year))",
                        year,
                        tableau.FilterUpdateType.REPLACE);
                    break;
                case "ALL":
                    activeSheet.applyFilterAsync(
                        "JAHR(Date (year))",
                        "",
                        tableau.FilterUpdateType.ALL);
                    break;
            }
        }

        /**
         * Range filter data by GDP value.
         * @param min - minimum value
         * @param max - maximum value
         */
        function applyGDPRangeFilter(min, max) {
            if(min === "-1" && max === "-1") {
                activeSheet.clearFilterAsync("F: GDP per capita (curr $)");
            } else if(max === "-1") {
                activeSheet.applyRangeFilterAsync(
                    "F: GDP per capita (curr $)",
                    {
                        min: min
                    },
                    tableau.FilterUpdateType.REPLACE);
            } else if(min === "-1") {
                activeSheet.applyRangeFilterAsync(
                    "F: GDP per capita (curr $)",
                    {
                        max: max
                    },
                    tableau.FilterUpdateType.REPLACE);
            } else {
                activeSheet.applyRangeFilterAsync(
                    "F: GDP per capita (curr $)",
                    {
                        min: min,
                        max: max
                    },
                    tableau.FilterUpdateType.REPLACE);
            }
        }

        /**
         * Build annyang command for selecting/filtering certain countries
         */
        function buildSelectFilterCountryCmd() {
            var columnIndex = 0;
            var data;
            // define options for data pull
            var options = {
                maxRows: 0,
                ignoreAliases: false,
                ignoreSelection: true
            };
            // get underlying Data of active sheet
            activeSheet.getUnderlyingDataAsync(options).then(function (d) {
                data = d;
                // start building regex
                var buildSelectAdd = "^select country (";
                var buildSelectReplace = "^select and replace country (";
                var buildSelectRemove = "^remove selection of country (";
                var buildFilterAdd = "^filter by country (";
                var buildFilterReplace = "^replace filter with country (";
                var buildFilterRemove = "^remove filter of country (";
                // delete last | from loop
                var countriesToString = buildAltRegex(data, columnIndex);
                // complete regex
                buildSelectAdd = buildSelectAdd.concat(countriesToString, ')$');
                buildSelectReplace = buildSelectReplace.concat(countriesToString, ')$');
                buildSelectRemove = buildSelectRemove.concat(countriesToString, ')$');
                buildFilterAdd = buildFilterAdd.concat(countriesToString, "|all", ')$');
                buildFilterReplace = buildFilterReplace.concat(countriesToString, ')$');
                buildFilterRemove = buildFilterRemove.concat(countriesToString, ')$');
                // create RegExp objects
                var regexAddSel = new RegExp(buildSelectAdd);
                var regexReplaceSel = new RegExp(buildSelectReplace);
                var regexRemoveSel = new RegExp(buildSelectRemove);
                var regexAddFil = new RegExp(buildFilterAdd);
                var regexReplaceFil = new RegExp(buildFilterReplace);
                var regexRemoveFil = new RegExp(buildFilterRemove);
                console.log(regexAddSel);
                // build annyang commands, add afterwards
                var cmd = {
                    'select country :country': {
                        'regexp': regexAddSel,
                        'callback': addSelectMarkFromCountries
                    },
                    'select and replace country :country': {
                        'regexp': regexReplaceSel,
                        'callback': replaceSelectMarkFromCountries
                    },
                    'remove selection of country :country': {
                        'regexp': regexRemoveSel,
                        'callback': removeSelectMarkFromCountries
                    },
                    'filter by country :country': {
                        'regexp': regexAddFil,
                        'callback': addCountryFilter
                    },
                    'replace filter with country :country': {
                        'regexp': regexReplaceFil,
                        'callback': replaceCountryFilter
                    },
                    'remove filter of country :country': {
                        'regexp': regexRemoveFil,
                        'callback': removeCountryFilter
                    }
                };
                var cmdKeys = Object.keys(cmd);
                var cmdString = cmdKeys.join("<br>");
                annyang.addCommands(cmd);
                $("#cmdTarget").append("<p>" + cmdString + "</p>");
            });

            /**
             * select mark and add to previous selection
             * @param mark - mark to be selected
             */
            function addSelectMarkFromCountries(mark) {
                // call function for matching possible case sensitive issues
                var country = matchVoiceToDataCase(data, columnIndex, mark);
                activeSheet.selectMarksAsync(
                    "Country / Region",
                    country,
                    tableau.FilterUpdateType.ADD);
                console.log("MARKED");
            }

            /**
             * select mark and replace previous selection
             * @param mark - mark to be selected
             */
            function replaceSelectMarkFromCountries(mark) {
                // call function for matching possible case sensitive issues
                var country = matchVoiceToDataCase(data, columnIndex, mark);
                activeSheet.selectMarksAsync(
                    "Country / Region",
                    country,
                    tableau.FilterUpdateType.REPLACE);
                console.log("MARKED/REPLACED");
            }

            /**
             * remove mark from previous selection
             * @param mark - mark to be removed
             */
            function removeSelectMarkFromCountries(mark) {
                // call function for matching possible case sensitive issues
                var country = matchVoiceToDataCase(data, columnIndex, mark);
                activeSheet.selectMarksAsync(
                    "Country / Region",
                    country,
                    tableau.FilterUpdateType.REMOVE);
                console.log("REMOVED");
            }

            /**
             * Add a filter by certain country
             * @param country - country passed to filter
             */
            function addCountryFilter(country) {
                var uppercase = country.toUpperCase();
                if(uppercase === "ALL") {
                    activeSheet.applyFilterAsync(
                        "Country / Region",
                        "",
                        tableau.FilterUpdateType.ALL);
                } else {
                    var match = matchVoiceToDataCase(data, columnIndex, country);
                    activeSheet.applyFilterAsync(
                        "Country / Region",
                        match,
                        tableau.FilterUpdateType.ADD);
                }
            }

            /**
             * Replace a filter with another country filter
             * @param country - country passed to filter
             */
            function replaceCountryFilter(country) {
                var match = matchVoiceToDataCase(data, columnIndex, country);
                activeSheet.applyFilterAsync(
                    "Country / Region",
                    match,
                    tableau.FilterUpdateType.REPLACE);
            }

            /**
             * Remove a country filter
             * @param country - region passed to filter
             */
            function removeCountryFilter(country) {
                var match = matchVoiceToDataCase(data, columnIndex, country);
                activeSheet.applyFilterAsync(
                    "Country / Region",
                    match,
                    tableau.FilterUpdateType.REMOVE);
            }
        }

        /**
         * Build annyang command for selecting/filtering certain region
         */
        function buildSelectFilterRegionCmd() {
            var columnIndex = 2;
            var data;
            // start building regex
            var buildSelectAdd = "^select Region (";
            var buildSelectReplace = "^replace selection with Region (";
            var buildSelectRemove = "^remove selection of Region (";
            var buildFilterAdd = "^filter by Region (";
            var buildFilterReplace = "^replace filter with Region (";
            var buildFilterRemove = "^remove filter of Region (";
            // define options for data pull
            var options = {
                maxRows: 0,
                ignoreAliases: false,
                ignoreSelection: true
            };
            // get underlying Data of active sheet
            activeSheet.getUnderlyingDataAsync(options).then(function (d) {
                data = d;
                var regionsToString = buildAltRegex(data, columnIndex);
                // complete regex build
                buildSelectAdd = buildSelectAdd.concat(regionsToString, ')$');
                buildSelectReplace = buildSelectReplace.concat(regionsToString, ')$');
                buildSelectRemove = buildSelectRemove.concat(regionsToString, ')$');
                buildFilterAdd = buildFilterAdd.concat(regionsToString, "|all", ')$');
                buildFilterReplace = buildFilterReplace.concat(regionsToString, ')$');
                buildFilterRemove = buildFilterRemove.concat(regionsToString, ')$');
                // create RegExp objects
                var regexAddSel = new RegExp(buildSelectAdd);
                var regexReplaceSel = new RegExp(buildSelectReplace);
                var regexRemoveSel = new RegExp(buildSelectRemove);
                var regexAddFil = new RegExp(buildFilterAdd);
                var regexReplaceFil = new RegExp(buildFilterReplace);
                var regexRemoveFil = new RegExp(buildFilterRemove);
                console.log(regexAddSel);
                // build annyang commands, add afterwards
                var cmd = {
                    'select Region :region': {
                        'regexp': regexAddSel,
                        'callback': addSelectMarkFromRegions
                    },
                    'select and replace Region :region': {
                        'regexp': regexReplaceSel,
                        'callback': replaceSelectMarkFromRegions
                    },
                    'remove selection of Region :region': {
                        'regexp': regexRemoveSel,
                        'callback': removeSelectMarkFromRegions
                    },
                    'filter by Region :region': {
                        'regexp': regexAddFil,
                        'callback': addRegionFilter
                    },
                    'replace filter with Region :region': {
                        'regexp': regexReplaceFil,
                        'callback': replaceRegionFilter
                    },
                    'remove filter of Region :region': {
                        'regexp': regexRemoveFil,
                        'callback': removeRegionFilter
                    }
                };
                var cmdKeys = Object.keys(cmd);
                var cmdString = cmdKeys.join("<br>");
                annyang.addCommands(cmd);
                $("#cmdTarget").append("<p>" + cmdString + "</p>");
            });

            /**
             * select mark and add to previous selection
             * @param mark - mark to be selected
             */
            function addSelectMarkFromRegions(mark) {
                // call function for matching possible case sensitive issues
                var region = matchVoiceToDataCase(data, columnIndex, mark);
                activeSheet.selectMarksAsync(
                    "Region",
                    region,
                    tableau.FilterUpdateType.ADD);
                console.log("MARKED");
            }

            /**
             * select mark and replace previous selection
             * @param mark - mark to be selected
             */
            function replaceSelectMarkFromRegions(mark) {
                // call function for matching possible case sensitive issues
                var region = matchVoiceToDataCase(data, columnIndex, mark);
                activeSheet.selectMarksAsync(
                    "Region",
                    region,
                    tableau.FilterUpdateType.REPLACE);
                console.log("MARKED/REPLACED");
            }

            /**
             * remove mark from previous selection
             * @param mark - mark to be removed
             */
            function removeSelectMarkFromRegions(mark) {
                // call function for matching possible case sensitive issues
                var region = matchVoiceToDataCase(data, columnIndex, mark);
                activeSheet.selectMarksAsync(
                    "Region",
                    region,
                    tableau.FilterUpdateType.REMOVE);
                console.log("REMOVED");
            }

            /**
             * Add a filter by certain region
             * @param region - region passed to filter
             */
            function addRegionFilter(region) {
                var uppercase = region.toUpperCase();
                if(uppercase === "ALL") {
                    activeSheet.applyFilterAsync(
                        "Region",
                        "",
                        tableau.FilterUpdateType.ALL);
                } else {
                    var match = matchVoiceToDataCase(data, columnIndex, region);
                    activeSheet.applyFilterAsync(
                        "Region",
                        match,
                        tableau.FilterUpdateType.ADD);
                }
            }

            /**
             * Replace a filter with another region filter
             * @param region - region passed to filter
             */
            function replaceRegionFilter(region) {
                var match = matchVoiceToDataCase(data, columnIndex, region);
                activeSheet.applyFilterAsync(
                    "Region",
                    match,
                    tableau.FilterUpdateType.REPLACE);
            }

            /**
             * Remove a region filter
             * @param region - region passed to filter
             */
            function removeRegionFilter(region) {
                var match = matchVoiceToDataCase(data, columnIndex, region);
                activeSheet.applyFilterAsync(
                    "Region",
                    match,
                    tableau.FilterUpdateType.REMOVE);
            }
        }

        function retrieveValue() {

        }

        /**
         * Utility function.
         * Transform an annyang voice input for trying to match it to the corresponding
         * counterpart in Tableau data.
         * @param {Object} data - Tableau underlying data object
         * @param {int} columnIndex - index of column of Tableau data
         * @param {String} voiceInput - Recorded voice input snippet from SpeechRecognition
         */
        function matchVoiceToDataCase(data, columnIndex, voiceInput) {
            var rowData = data.getData();
            var voiceCase = voiceInput.toLowerCase();
            var index, dataCase;
            var dataString = "";
            for (var i = 0; i < rowData.length; i++) {
                index = rowData[i];
                dataString = index[columnIndex].formattedValue.toString();
                dataCase = dataString.toLowerCase();
                if (dataCase === voiceCase) {
                    return dataString;
                }
            }
        }

        /**
         * Utility function.
         * Build a part of a regex alternative command from a certain Tableau data column.
         * @param {Object} dat - Tableau underlying data object
         * @param {int} columnIndex - index of column of Tableau data
         */
        function buildAltRegex(dat, columnIndex) {
            var altRegex = "";
            // get data rows of active sheet
            var data = dat.getData();
            var index, help;
            // iterate through rows, concatenate each region to regex string if string not containing region
            for (var i = 0; i < data.length; i++) {
                index = data[i];
                help = index[columnIndex].formattedValue.toString();
                if (altRegex.indexOf(help) === -1) {
                    altRegex = altRegex.concat(help, '|')
                }
            }
            // delete last | from loop
            altRegex = altRegex.substring(0, altRegex.length - 1);
            return altRegex;
        }

        /**
         * Build beta fuzzy functions
         * Functions matching input command to data by using string similarity (provided by fuse.js).
         */
        function buildFuzzyCmds() {
            var data, columns;
            var columnprops = [];
            var columnnames = [];

            var options = {
                maxRows: 0,
                ignoreAliases: false,
                ignoreSelection: true
            };
            activeSheet.getUnderlyingDataAsync(options).then(function (d) {
                data = d;
                columns = data.getColumns();
                columns.forEach(function(item, index, array) {
                    var singlecolumn = {
                        index: item.getIndex(),
                        name: item.getFieldName()
                    };
                    columnprops.push(singlecolumn);
                    columnnames.push(item.getFieldName());
                });
                var cmds = {
                    /*'test *multiple words': function() { alert('Multiple!'); },*/
                    'select *mark from column *column': fuzzySelect,
                    'display data for country *country': displayCountryData
                };
                var cmdKeys = Object.keys(cmds);
                var cmdString = cmdKeys.join("<br>");
                annyang.addCommands(cmds);
                $("#cmdTarget").append("<h2 id='available'>Beta Command String Similarity:</h2>" +
                    "<p>Suitable for Country & Region</p><p>" + cmdString + "</p>");
            });

            /**
             * Actual select function executed on voice command match.
             * Selecting marks by matching with string similarity (provided by fuse.js) of input command.
             * @param {String} mark - desired mark from fetched voice input
             * @param {String} column - desired column from fetched voice input
             */
            function fuzzySelect(mark, column) {
                var columnindex;
                var marks = [];
                var fusecolumns = new Fuse(columnnames, fuseoptions);
                var fuzzycolumnresult = fusecolumns.search(column);
                var columnmatch = columnnames[fuzzycolumnresult[0]];
                for (let item of columnprops) {
                    if (item.name === columnnames[fuzzycolumnresult[0]]) {
                        columnindex = item.index;
                        break;
                    }
                }
                var rowData = data.getData();
                for (var i = 0; i < rowData.length; i++) {
                    var dataelement = rowData[i];
                    var help = dataelement[columnindex].formattedValue.toString();
                    marks.push(help);
                }
                var fusemarks = new Fuse(marks, fuseoptions);
                var fuzzymarkresult = fusemarks.search(mark);
                var markmatch = marks[fuzzymarkresult[0]];
                activeSheet.selectMarksAsync(
                    columnmatch,
                    markmatch,
                    tableau.FilterUpdateType.REPLACE);
            }

            /**
             * Actual select function executed on voice command match.
             * Selecting marks by matching with string similarity (provided by fuse.js) of input command.
             * @param {String} country - desired mark from fetched voice input
             */
            function displayCountryData(country) {
                var rowData = data.getData();
                var countries = [];
                var fusecolumns = new Fuse(columnnames, fuseoptions);
                var fuzzycolumnresult = fusecolumns.search("Country");
                var columnmatch = columnnames[fuzzycolumnresult[0]];
                var columnindex;
                for (let item of columnprops) {
                    if (item.name === columnmatch) {
                        columnindex = item.index;
                        break;
                    }
                }
                for (var i = 0; i < rowData.length; i++) {
                    var dataelement = rowData[i];
                    var help = dataelement[columnindex].formattedValue.toString();
                    countries.push(help);
                }
                var fusecountries = new Fuse(countries, fuseoptions);
                var fuzzycountryresult = fusecountries.search(country);
                var countrymatch = countries[fuzzycountryresult[0]];
                console.log(countrymatch);
                var countryboxtitle = "Data of Country ";
                var countrystring = "";
                countryboxtitle = countryboxtitle.concat(countrymatch, ": ");
                console.log(countrystring);
                for (var i = 0; i < rowData.length; i++) {
                    var dataelement = rowData[i];
                    if (dataelement[columnindex].formattedValue.toString() === countrymatch) {
                        for (var i = 0; i < dataelement.length; i++) {
                            countrystring = countrystring.concat(columnnames[i], ": ", dataelement[i].formattedValue.toString(), "<br>");
                        }
                        console.log(countrystring);
                        break;
                    }
                }
                $("<div>"+countrystring+"</div>").dialog({
                    title: countryboxtitle
                });
            }
        }
    });
})();