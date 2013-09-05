/*! jQuery jSlabify plugin v2.5 MIT/GPL2 @gschoppe */
(function( $ ){
    $.fn.jSlabify = function(options) {
        var settings = {
            //target the container's font size, regardless of height
            "targetFont"            : false,
            //when targeted by font, enlarge base size by this multiplier
            "fontZoom"              : 1,
            //If the actual height is greater than the box size (as defined by css or ratio), do we resize?
            "constrainHeight"       : false,
            // The ratio between container width and ideal height
            "slabRatio"             : 1,
            // is the container height fixed in the css?
            "fixedHeight"           : false,
            // force center horizontally with text-align on the wrapped div
            "hCenter"               : false,
            // center vertically with a top position on the wrapped div
            "vCenter"               : false,
            // Always recalculate the characters per line, not just when the 
            // font-size changes? Defaults to true (CPU intensive)
            "forceNewCharCount"     : true,
            // Do we wrap ampersands in <span class="amp"> 
            "wrapAmpersand"         : true,
            // Under what pixel width do we remove the slabtext styling?
            "headerBreakpoint"      : null,
            "viewportBreakpoint"    : null,
            // Don't attach a resize event
            "noResizeEvent"         : false,
            // By many milliseconds do we throttle the resize event
            "resizeThrottleTime"    : 300,
            // The maximum pixel font size the script can set
            "maxFontSize"           : 999,
            // Do we try to tweak the letter-spacing or word-spacing?
            "postTweak"             : true,
            // what is the minimum wordspacing to allow (ratio to space-width)?
            "minWordSpace"          : .4,
            // what is the maximum wordspacing to allow (ratio to space-width)?
            "maxWordSpace"          : 3,
            // what is the maximum letterspacing to allow (ratio to space-width)?
            "maxLetterSpace"        : 1.5,
            // Decimal precision to use when setting CSS values
            "precision"             : 3,
            // The min num of chars a line has to contain
            "minCharsPerLine"       : 2
            };
        
        // Add the slabtexted classname to the body to initiate the styling of
        // the injected spans
        $("body").addClass("slabified");
            
        return this.each(function(){
            if(options)
                $.extend(settings, options);
            
            var $this               = $(this),
                keepSpans           = $("span.slabbedtext", $this).length,
                origFontSize        = null,
                spaceRatio          = null,
                idealCharPerLine    = null,
                words               = String($.trim($this.text())).replace(/\s{2,}/g, " ").split(" "),
                sections            = [],
                ungroupedstring     = [],
                targetFont          = settings.targetFont,
                fontZoom            = settings.fontZoom,
                constrainHeight     = settings.constrainHeight,
                slabRatio           = settings.slabRatio,
                fixedHeight         = settings.fixedHeight,
                hCenter             = settings.hCenter,
                vCenter             = settings.vCenter,
                forceNewCharCount   = settings.forceNewCharCount,
                headerBreakpoint    = settings.headerBreakpoint,
                viewportBreakpoint  = settings.viewportBreakpoint,
                postTweak           = settings.postTweak,
                minWordSpace        = settings.minWordSpace,
                maxWordSpace        = settings.maxWordSpace,
                maxLetterSpace      = settings.maxLetterSpace,
                precision           = settings.precision,
                resizeThrottleTime  = settings.resizeThrottleTime,
                minCharsPerLine     = settings.minCharsPerLine,
                resizeThrottle      = null,
                viewportWidth       = $(window).width(),
                headLink            = $this.find("a:first").attr("href") || $this.attr("href"),
                linkTitle           = (headLink) ? $this.find("a:first").attr("title") : "";
            
            if(!keepSpans && minCharsPerLine && words.join(" ").length < minCharsPerLine)
                return;
            
            if(keepSpans) {  //build array of sections to later slab
                var div=document.createElement("div");  // creates a new temp div that we can mess-up without affecting the page
                $(div).html($this.html());              // fills temp div with existing div content

                var a, 
                    remainder;
                while(a=div.querySelectorAll("span.slabbedtext")[0]) {  // continues grabbing all span.slabbedtext tags until none are left:
                    var groupedValue   = $(a).text();
                    if(settings.wrapAmpersand)
                                groupedValue = groupedValue.replace(/&/g, "<span class=\"amp\">&amp;</span>");
                    var ungroupedValue = $(a)[0].previousSibling;
                    ungroupedValue     = (ungroupedValue&&ungroupedValue.nodeValue) ? ungroupedValue.nodeValue.replace(/\s{2,}/g, " ").trim() : "";
                    remainder          = $(a)[0].nextSibling;
                    remainder          = (remainder&&remainder.nodeValue) ? remainder.nodeValue.replace(/\s{2,}/g, " ").trim() : "";
                    if(ungroupedValue != "") {
                        sections.push({type: 0, value: ungroupedValue });     // push the other text to the stack
                        ungroupedstring.push(ungroupedValue);
                    }
                    sections.push({type: 1, value: groupedValue});            // push the span code to the stack
                    $(a).prevAll().remove();
                    $(a).remove();
                }
                if(remainder != "") {
                    sections.push({type: 0, value: remainder }); // push the last remaining text to the stack
                    ungroupedstring.push(remainder);
                }
                ungroupedstring = ungroupedstring.join(" ");
                $(div).remove();   
            }
            
            
            // Calculates the pixel equivalent of 1em within the current header
            var grabFontInfo = function() {
                var theString     = words.join(" "),
                    contentLength = theString.length,
                    content       = (theString.length > 0) ? theString : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-'\".,?!&";
                    divDef        = "<div style=\"display:none;font-size:1em;margin:0;padding:0;height:auto;line-height:"+$this.css("line-height")+";border:0;white-space:nowrap;word-spacing:0;letter-spacing:0;\">",
                    dummy         = $(divDef+content+"</div>").appendTo($this),
                    emW           = dummy.width(),
                    emH           = dummy.height(),
                    ratio         = (emH == 0) ? 1 : emW/emH,
                    charRatio     = ratio/content.length
                    dummy2        = $(divDef+"&nbsp;"+"</div>").appendTo($this),
                    spaceRatio    = dummy2.width()/parseFloat(dummy2.css("font-size"),10);
                dummy.remove();
                dummy2.remove();
                return [emW, emH, ratio, content.length, charRatio, spaceRatio];
            };
            
            // The original slabtype algorithm was written by Eric Loyer:
            // http://erikloyer.com/index.php/blog/the_slabtype_algorithm_part_1_background/
            // The optimal line length calculation has been totally replaced by a geometric method,
            // written by Gregory Schoppe and a font-size-based method, written by Brian McAllister
            var resizeSlabs = function resizeSlabs() {
                // Cache the parent containers width       
                var parentWidth = $this.width(),
                    parentHeight = (fixedHeight) ? $this.height() : parentWidth/slabRatio,
                    fontInfo,
                    fs;
                
                if(vCenter) {
                    $this.height(parentHeight);
                } else if(!fixedHeight) {
                    $this.css("height", "auto");
                }
                
                // Remove the slabtextdone and slabtextinactive classnames to enable the inline-block shrink-wrap effect
                $this.removeClass("slabbedtextdone slabbedtextinactive");
                
                if(   viewportBreakpoint && viewportBreakpoint > viewportWidth
                   || headerBreakpoint   && headerBreakpoint   > parentWidth  ) {
                    // Add the slabtextinactive classname to set the spans as inline
                    // and to reset the font-size to 1em (inherit won't work in IE6/7)
                    $this.addClass("slabbedtextinactive");
                    return;
                }
                
                
                fontInfo = grabFontInfo();
                // If the parent containers font-size has changed or the "forceNewCharCount" option is true (the default),
                // then recalculate the "characters per line" count and re-render the inner spans
                // Setting "forceNewCharCount" to false will save CPU cycles...
                if(forceNewCharCount || fs != origFontSize) {
                    origFontSize = fontInfo[1];
                    spaceRatio   = fontInfo[5];
                    // legacy slabtext support
                    if(targetFont) {
                        var charRatio       = fontInfo[4],
                            newCharPerLine  = Math.min(60, Math.floor(parentWidth / (origFontSize * charRatio * fontZoom)));
                            lineCount       = Math.round(fontInfo[3]/newCharPerLine);
                    } else {
                        var textLength      = fontInfo[3],
                            textRatio       = fontInfo[2],
                            boxRatio        = parentWidth / parentHeight,
                            lineCount       = Math.round(Math.sqrt(textRatio/boxRatio)),
                            newCharPerLine  = Math.min(60, Math.max(Math.round(textLength/lineCount), 1));
                    }
                    
                    function makeSlabSpans(charPerLine, sectionWords) {
                        var wordIndex       = 0,
                            lineText        = [],
                            counter         = 0,
                            preText         = "",
                            postText        = "",
                            finalText       = "",
                            slice,
                            preDiff,
                            postDiff;
                        
                        idealCharPerLine = charPerLine;
                                                                
                        while (wordIndex < sectionWords.length) {
                       
                            postText = "";

                            // build two strings (preText and postText) word by word, with one
                            // string always one word behind the other, until
                            // the length of one string is less than the ideal number of characters
                            // per line, while the length of the other is greater than that ideal
                            while (postText.length <= idealCharPerLine) {
                                preText   = postText;
                                postText += sectionWords[wordIndex] + " ";
                                if(++wordIndex >= sectionWords.length) {
                                    break;
                                }
                            }
                            preText  = $.trim(preText);
                            postText = $.trim(postText);
                            // calculate the character difference between the two strings and the
                            // ideal number of characters per line
                            preDiff       = idealCharPerLine - preText.length;
                            postDiff      = postText.length - idealCharPerLine;
                            
                            // if the smaller string is closer to the length of the ideal than
                            // the longer string, and doesn't contain less than minCharsPerLine
                            // characters, then use that one for the line
                            if((preDiff < postDiff) && (preText.length >= Math.max(minCharsPerLine || 2))) {
                                finalText = preText;
                                wordIndex--;
                            // otherwise, use the longer string for the line
                            } else {
                                finalText = postText;
                            }
                            // calculate whether it's better to just add the rest now
                            remainingText = sectionWords.slice(wordIndex).join(" ");
                            if(remainingText.length > 0 && remainingText.length < idealCharPerLine) {
                                newLineDiff   = Math.max(((idealCharPerLine - remainingText.length), Math.abs(finalText.length - idealCharPerLine)));
                                oneLineDiff   = Math.abs(finalText.length + remainingText.length + 1 - idealCharPerLine);
                                if(oneLineDiff < newLineDiff || remainingText.length < Math.max(minCharsPerLine, 3)) {
                                    finalText += " " + remainingText;
                                    wordIndex = sectionWords.length;
                                }
                            }
                            
                            // HTML-escape the text
                            finalText = $('<div/>').text(finalText).html();
                            // Wrap ampersands in spans with class `amp` for specific styling
                            if(settings.wrapAmpersand)
                                finalText = finalText.replace(/&amp;/g, "<span class=\"amp\">&amp;</span>");
                            finalText = $.trim(finalText);
                            lineText.push("<span class=\"slabbedtext\">" + finalText + "</span>");
                        }
                        return lineText;
                    }
                    if(!keepSpans) {
                        $this.html(makeSlabSpans(newCharPerLine, words).join(""));
                    }else{
                        lineCount = Math.max(lineCount, sections.length);
                        var unusedLines = lineCount - keepSpans;
                        var finalSlabs = [];
                        for(var i = 0; i < sections.length; i++) {
                            if(sections[i].type) {
                                finalSlabs.push("<span class=\"slabbedtext\">" + sections[i].value + "</span>");
                            } else {
                                var section = String($.trim(sections[i].value));
                                charPerLine = section.length/Math.max(Math.round(unusedLines * section.length/ungroupedstring.length), 1);
                                sectionWords = section.replace(/\s{2,}/g, " ").split(" ");
                                finalSlabs = finalSlabs.concat(makeSlabSpans(charPerLine, sectionWords));
                            }
                        }
                        $this.html(finalSlabs.join(""));
                    }
                    // If we have a headLink, add it back just inside our target, around all the slabText spans
                    if(headLink)
                        $this.wrapInner("<a href=\"" + headLink + "\" " + (linkTitle ? "title=\"" + linkTitle + "\" " : "") + "/>");
                } else {
                    // We only need the font-size for the resize-to-fit functionality
                    // if not injecting the spans 
                    origFontSize = fontInfo[1];
                }
                //create wrapper div for centering, if none exists
                if(!($this.has("div.innerslabwrap").length>0)) {
                    $this.wrapInner('<div class="innerslabwrap" />');
                }
                var $inner = $this.children("div.innerslabwrap");
                $inner.css("font-size", 1 + "em");
                $("span.slabbedtext", $this).each(function() {
                    var $span       = $(this),
                        // the .text method appears as fast as using custom -data attributes in this case
                        innerText   = $span.text(),
                        wordSpacing = innerText.split(" ").length > 1,
                        fontSize  = parseFloat($span.css("font-size"),10),
                        ratio,
                        newSize;
                    if(postTweak) {
                        if(wordSpacing) {
                            $span.css({"word-spacing":""+fontSize*spaceRatio*minWordSpace-spaceRatio*fontSize+"px", "letter-spacing":0});
                            var spaceCount = innerText.split(" ").length - 1;
                            if (spaceCount < 0)
                                spaceCount = 0;
                        } else {
                            $span.css("letter-spacing", 0);
                        }
                    }
                    $span.css("font-size", 1 + "em");
                    ratio    = ($span.width() > 0) ? parentWidth / $span.width() : 1;
                    newSize = (Math.min((origFontSize * ratio), settings.maxFontSize)/origFontSize).toFixed(precision);
                    $span.css("font-size", newSize + "em");
                });
                var newMultiplier = 1;
                if(constrainHeight && ($inner.height() > parentHeight)) {
                    newMultiplier = (parentHeight / $inner.height()).toFixed(precision);
                    $inner.css("font-size", newMultiplier + "em");
                }
                if(postTweak){
                    $("span.slabbedtext", $this).each(function() {
                        var $span       = $(this),
                            innerText = $span.text(),
                            // should we start with word-spacing?
                            wordCount = innerText.split(" ").length,
                            // Do we still have space to try to fill or crop?
                            diff      = parentWidth - $span.width(),
                            fontSize  = parseFloat($span.css("font-size"),10);
                        // A "dumb" tweak in the blind hope that the browser will
                        // resize the text to better fit the available space.
                        // Better "dumb" and fast...
                        if (wordCount > 1) {
                            var spacing = diff / (wordCount - 1);
                            if( spacing < fontSize*spaceRatio*minWordSpace ) {
                                spacing = fontSize*spaceRatio*minWordSpace;
                            //upper limit on word-spacing
                            } else if(spacing > fontSize*spaceRatio*maxWordSpace) {
                                spacing = fontSize*spaceRatio*maxWordSpace;
                            }
                            // subtract the number of pixels to zero spacing
                            spacing = spacing - fontSize*spaceRatio;
                            $span.css('word-spacing', spacing.toFixed(precision) + "px");
                            // Do we still have space to try to fill or crop?
                            diff = parentWidth - $span.width();
                        }
                        var spacing = diff / innerText.length;
                        if( spacing < 0 ) {
                            spacing = 0;
                        //upper limit on letter-spacing
                        } else if(spacing > fontSize*spaceRatio*maxLetterSpace) {
                            spacing = fontSize*spaceRatio*maxLetterSpace;
                        }
                        $span.css('letter-spacing', spacing.toFixed(precision) + "px");
                        if( (parentWidth - $span.width())/parentWidth > .1 ) {
                            $span.css('letter-spacing', 0);
                            $span.css('word-spacing', 0);
                        }
                    });
                }
                // Add the class slabtextdone to set a display:block on the child spans
                // and avoid styling & layout issues associated with inline-block
                $this.addClass("slabbedtextdone");
                // Apply final centering, if necessary
                if(hCenter)
                    $inner.css("text-align", 'center');
                if(constrainHeight && vCenter) {
                    var topPad = ((parentHeight-$inner.height())/2).toFixed(precision);
                    $inner.css("position", 'relative').css("top", topPad + "px");
                }
            };
            // Immediate resize
            resizeSlabs();
            if(!settings.noResizeEvent) {
                $(window).resize(function() {
                    // Only run the resize code if the viewport width has changed.
                    // we ignore the viewport height as it will be constantly changing.
                    if($(window).width() == viewportWidth)
                        return;
                    viewportWidth = $(window).width();
                    clearTimeout(resizeThrottle);
                    resizeThrottle = setTimeout(resizeSlabs, resizeThrottleTime);
                });
            }
        });
    };
})(jQuery);