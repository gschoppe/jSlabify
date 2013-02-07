/*! jQuery jSlabify plugin v1.0 MIT/GPL2 @gschoppe */
(function( $ ){  
        
    $.fn.jSlabify = function(options) {
    
        var settings = {
            // The ratio used when calculating the characters per line 
            // (parent width / (font-size * fontRatio)). 
            "fontRatio"             : 0.472,
            // The ratio between ideal width and ideal height
            "boxRatio"              : 1,
            // is the height fixed in css?
            "fixedHeight"           : false,
            // center vertically with border-box padding
            "borderBox"             : false,
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
            // Decimal precision to use when setting CSS values
            "precision"             : 3,
            // The min num of chars a line has to contain
            "minCharsPerLine"       : 0
            };
        
        // Add the slabtexted classname to the body to initiate the styling of
        // the injected spans
        $("body").addClass("slabtexted");
            
        return this.each(function(){
            
            if(options) {
                    $.extend(settings, options);
            };
            
            var $this               = $(this),
                keepSpans           = $("span.slabtext", $this).length,
                words               = keepSpans ? [] : String($.trim($this.text())).replace(/\s{2,}/g, " ").split(" "),
                origFontSize        = null,
                idealCharPerLine    = null,
                fontRatio           = settings.fontRatio,
                boxRatio            = settings.boxRatio,
                fixedHeight         = settings.fixedHeight,
                borderBox           = settings.borderBox,
                forceNewCharCount   = settings.forceNewCharCount,
                headerBreakpoint    = settings.headerBreakpoint,
                viewportBreakpoint  = settings.viewportBreakpoint,
                postTweak           = settings.postTweak,
                precision           = settings.precision,
                resizeThrottleTime  = settings.resizeThrottleTime,
                minCharsPerLine     = settings.minCharsPerLine,
                resizeThrottle      = null,
                viewportWidth       = $(window).width(),
                headLink            = $this.find("a:first").attr("href") || $this.attr("href"),
                linkTitle           = headLink ? $this.find("a:first").attr("title") : "";
            
            if(!keepSpans && minCharsPerLine && words.join(" ").length < minCharsPerLine) {
                return;
            };
            
            // Calculates the pixel equivalent of 1em within the current header
            var grabPixelFontSize = function() {
                var dummy = jQuery('<div style="display:none;font-size:1em;margin:0;padding:0;height:auto;line-height:1;border:0;">&nbsp;</div>').appendTo($this),
                    emH   = dummy.height();
                dummy.remove();
                return emH;
            };             
            
            // The original slabtype algorithm was written by Eric Loyer:
            // http://erikloyer.com/index.php/blog/the_slabtype_algorithm_part_1_background/
            // The optimal line length calculation has been totally replaced by a geometric method,
            // written by Gregory Schoppe
            var resizeSlabs = function resizeSlabs() {
                    
                // Cache the parent containers width       
                var parentWidth = $this.width(),
                    parentHeight = (fixedHeight)?$this.height():parentWidth/boxRatio,
                    fs;
                                    
                // Remove the slabtextdone and slabtextinactive classnames to enable the inline-block shrink-wrap effect
                $this.removeClass("slabtextdone slabtextinactive");
                
                if(viewportBreakpoint && viewportBreakpoint > viewportWidth
                   ||
                   headerBreakpoint && headerBreakpoint > parentWidth) {
                    // Add the slabtextinactive classname to set the spans as inline
                    // and to reset the font-size to 1em (inherit won't work in IE6/7)
                    $this.addClass("slabtextinactive");
                    return;
                };
                
                fs = grabPixelFontSize(); 
                // If the parent containers font-size has changed or the "forceNewCharCount" option is true (the default),
                // then recalculate the "characters per line" count and re-render the inner spans
                // Setting "forceNewCharCount" to false will save CPU cycles...
                if(!keepSpans && (forceNewCharCount || fs != origFontSize)) {
                            
                    origFontSize = fs;

                    var textLength      = words.join(" ").length,
                        textRatio       = textLength * fontRatio,
                        boxRatio        = parentWidth / parentHeight,
                        lineCount       = Math.round(Math.sqrt(textRatio/boxRatio)),
                        newCharPerLine  = Math.min(60, Math.max(Math.round(textLength/lineCount), 1)),
                        wordIndex       = 0,
                        lineText        = [],
                        counter         = 0,
                        preText         = "",
                        postText        = "",
                        finalText       = "",
                        slice,
                        preDiff,
                        postDiff;
                                        
                    if(newCharPerLine != idealCharPerLine) {
                        idealCharPerLine = newCharPerLine;
                                                                
                        while (wordIndex < words.length) {
                       
                            postText = "";

                            // build two strings (preText and postText) word by word, with one
                            // string always one word behind the other, until
                            // the length of one string is less than the ideal number of characters
                            // per line, while the length of the other is greater than that ideal
                            while (postText.length < idealCharPerLine) {
                                preText   = postText;
                                postText += words[wordIndex] + " ";
                                if(++wordIndex >= words.length) {
                                    break;
                                };
                            };

                            // This bit hacks in a minimum characters per line test
                            // on the last line
                            if(minCharsPerLine) {
                                slice = words.slice(wordIndex).join(" ");
                                if(slice.length < minCharsPerLine) {
                                    postText += slice;
                                    preText = postText;
                                    wordIndex = words.length + 2;
                                };
                            };

                            // calculate the character difference between the two strings and the
                            // ideal number of characters per line
                            preDiff  = idealCharPerLine - preText.length;
                            postDiff = postText.length - idealCharPerLine;
            
                            // if the smaller string is closer to the length of the ideal than
                            // the longer string, and doesn’t contain less than minCharsPerLine
                            // characters, then use that one for the line
                            if((preDiff < postDiff) && (preText.length >= (minCharsPerLine || 2))) {
                                finalText = preText;
                                wordIndex--;
                            // otherwise, use the longer string for the line
                            } else {
                                finalText = postText;
                            };

                            // HTML-escape the text
                            finalText = $('<div/>').text(finalText).html()

                            // Wrap ampersands in spans with class `amp` for specific styling
                            if(settings.wrapAmpersand) {
                                finalText = finalText.replace(/&amp;/g, '<span class="amp">&amp;</span>');
                            };

                            finalText = $.trim(finalText)

                            lineText.push('<span class="slabtext">' + finalText + "</span>");
                        };
                                    
                        $this.html(lineText.join(" "));
                        // If we have a headLink, add it back just inside our target, around all the slabText spans
                        if(headLink) {
                            $this.wrapInner('<a href="' + headLink + '" ' + (linkTitle ? 'title="' + linkTitle + '" ' : '') + '/>');
                        };
                    };        
                } else {
                    // We only need the font-size for the resize-to-fit functionality
                    // if not injecting the spans 
                    origFontSize = fs;
                };
                
                var contentsHeight = 0;
                
                $("span.slabtext", $this).each(function() {
                    var $span       = $(this),
                        // the .text method appears as fast as using custom -data attributes in this case
                        innerText   = $span.text(),
                        wordSpacing = innerText.split(" ").length > 1,
                        diff,
                        ratio,
                        fontSize;
                    
                    if(postTweak) {   
                        $span.css({
                            "word-spacing":0, 
                            "letter-spacing":0
                            });
                    };
                    $this.css("font-size", 1 + "em");
                    $span.css("font-size", 1 + "em");
                    ratio    = parentWidth / $span.width();
                    var newSize = (Math.min((origFontSize * ratio), settings.maxFontSize)/origFontSize).toFixed(precision);
                    $span.css("font-size", newSize + "em");
                    contentsHeight += $span.height();
                    
                    // Do we still have space to try to fill or crop
                    diff = !!postTweak ? parentWidth - $span.width() : false;
                    
                    // A "dumb" tweak in the blind hope that the browser will
                    // resize the text to better fit the available space.
                    // Better "dumb" and fast...
                    if(diff) {
                        $span.css((wordSpacing ? 'word' : 'letter') + '-spacing', (diff / (wordSpacing ? innerText.split(" ").length - 1 : innerText.length)).toFixed(precision) + "px");
                    };
                });
                
                var newMultiplier = 1;
                if(contentsHeight > parentHeight) {
                    newMultiplier = (parentHeight / contentsHeight).toFixed(precision);
                    $this.css("font-size", newMultiplier + "em");
                }
                if(borderBox)
                    $this.css("padding", ((parentHeight-(contentsHeight*newMultiplier))/2) + "px 0");
                
                // Add the class slabtextdone to set a display:block on the child spans
                // and avoid styling & layout issues associated with inline-block
                $this.addClass("slabtextdone");
            };

            // Immediate resize
            resizeSlabs();     
                    
            if(!settings.noResizeEvent) {
                $(window).resize(function() {
                    // Only run the resize code if the viewport width has changed.
                    // we ignore the viewport height as it will be constantly changing.
                    if($(window).width() == viewportWidth) {
                        return;
                    };
                                    
                    viewportWidth = $(window).width();
                                    
                    clearTimeout(resizeThrottle);
                    resizeThrottle = setTimeout(resizeSlabs, resizeThrottleTime);
                });
            };        
        });
    };
})(jQuery);