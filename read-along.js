var ReadAlong = {
    text_element: null,
    audio_element: null,
    
    words: [],
    
    //current_begin_word: null,
    //current_end_word: null,
    //current_selected_range: null,
        
    init: function (args) {
        var name;
        for (name in args) {
            this[name] = args[name];
        }
        
        this.generateWordList();
        this.addEventListeners();
        
        // Once set up, enable the UI
        this.audio_element.hidden = false;
    },
    
    /**
     * Build an index of all of the words that can be read along with their begin,
     * and end times, and the DOM element representing the word.
     */
    generateWordList: function () {
        var word_els = this.text_element.querySelectorAll('[data-begin]');
        this.words = Array.prototype.map.call(word_els, function (word_el, index) {
            var word = {
                'begin': parseFloat(word_el.dataset.begin),
                'dur': parseFloat(word_el.dataset.dur),
                'element': word_el
            };
            word.index = index;
            word.end = word.begin + word.dur;
            word_el.dataset.index = word.index;
            return word;
        });
    },
        
    /**
     * From the audio's currentTime, find the word that is currently being played
     * @todo this would better be implemented as a binary search
     */
    getCurrentWord: function () {
        var i;
        var len;
        var is_current_word;
        var word = null;
        for (i = 0, len = this.words.length; i < len; i += 1) {
            is_current_word = (
                (
                    this.audio_element.currentTime >= this.words[i].begin
                    &&
                    this.audio_element.currentTime < this.words[i].end
                )
                ||
                (this.audio_element.currentTime < this.words[i].begin)
            );
            if (is_current_word) {
                word = this.words[i];
                break;
            }
        }
        
        if (!word) {
            throw Error('Unable to find current word and we should always be able to.');
        }
        return word;
    },
    
    
    /**
     * Select the current word and set timeout to select the next one if playing
     */
    selectCurrentWord: function() {
        var that = this;
        var current_word = this.getCurrentWord();
        var is_playing = !this.audio_element.paused;
        
        if (!current_word.element.classList.contains('speaking')) {
            this.removeWordSelection();
            current_word.element.classList.add('speaking');
        }

        /**
         * The timeupdate Media event does not fire repeatedly enough to be
         * able to rely on for updating the selected word (it hovers around
         * 250ms resolution), so we add a setTimeout with the exact duration
         * of the word.
         * @todo We will have to multiple the the seconds by the speech rate!
         */
        if (is_playing) {
            // Remove word selection when the word ceases to be spoken
            var seconds_until_this_word_ends = current_word.end - this.audio_element.currentTime; // Note: 'word' not 'world'! ;-)
            seconds_until_this_word_ends *= this.audio_element.playbackRate;
            setTimeout(
                function () {
                    if (!that.audio_element.paused) { // we always want to have a word selected while paused
                        current_word.element.classList.remove('speaking');
                    }
                },
                (seconds_until_this_word_ends * 1000)
            );

            // Automatically trigger selectCurrentWord when the next word begins
            var next_word = this.words[current_word.index + 1];
            if (next_word) {
                var seconds_until_next_word_begins = next_word.begin - this.audio_element.currentTime;
                seconds_until_next_word_begins *= this.audio_element.playbackRate;
                setTimeout(
                    function () {
                        that.selectCurrentWord();
                    },
                    (seconds_until_next_word_begins * 1000)
                );
                
            }
        }
        
    },
    
    removeWordSelection: function() {
        // There should only be one element with .speaking, but selecting all for good measure
        var spoken_word_els = this.text_element.querySelectorAll('span[data-begin].speaking');
        Array.prototype.forEach.call(spoken_word_els, function (spoken_word_el) {
            spoken_word_el.classList.remove('speaking');
        });
    },
    
    
    addEventListeners: function () {
        var that = this;
        
        /**
         * Select next word (at that.audio_element.currentTime) when playing begins
         */
        that.audio_element.addEventListener('play', function (e) {
            console.info(e.type);
            
            //var selection = window.getSelection();
            //if (selection.rangeCount !== 0) {
            //    var range = selection.getRangeAt(0);
            //    var begin_word_el = that._selectParentNodeUntilWord(range.startContainer);
            //    var end_word_el = that._selectParentNodeUntilWord(range.endContainer);
            //    
            //    var is_passage_selected = (
            //        !!range
            //        &&
            //        !range.collapsed
            //        &&
            //        that.text_element.contains(range.commonAncestorContainer)
            //        &&
            //        begin_word_el
            //        &&
            //        end_word_el
            //    );
            //    
            //    if (is_passage_selected) {
            //        //that.current_begin_word = begin_word_node;
            //        //that.current_end_word = end_word_node;
            //        that.audio_element.currentTime = that.words[begin_word_el.dataset.index].begin;
            //        that.current_selected_range = range;
            //        selection.removeAllRanges();
            //    }
            //
            //}
            
            that.selectCurrentWord();
            that.text_element.classList.add('speaking');
        });
        
        /**
         * Abandon seeking the next word because we're paused
         */
        that.audio_element.addEventListener('pause', function (e) {
            console.info(e.type);
            that.selectCurrentWord(); // We always want a word to be selected
            that.text_element.classList.remove('speaking');
            
            // if there was a selection, restore it.
            //if (that.current_selected_range !== null) {
            //    var selection = window.getSelection();
            //    selection.removeAllRanges();
            //    selection.addRange(that.current_selected_range);
            //    that.current_selected_range = null;
            //}
        });
        
        /**
         * Seek by clicking (event delegation)
         */
        that.text_element.addEventListener('click', function(e) {
            
            if (!e.target.dataset.begin) {
                return;
            }
            e.preventDefault();
            
            //var selection = window.getSelection();
            //that.current_begin_word = e.target;
            //that.current_end_word = e.target;
        
            var i = e.target.dataset.index;
            that.audio_element.currentTime = that.words[i].begin + 0.01; //Note: times apparently cannot be exactly set and sometimes select too early
            that.selectCurrentWord();
        });
        
        /**
         * First click handler sets currentTime to the word, and second click
         * here then causes it to play.
         * @todo Should it stop playing once the duration is over?
         */
        that.text_element.addEventListener('dblclick', function (e) {
            console.info(e.type);
            e.preventDefault();
            //that.audio_element.play();
        });
        
        /**
         * Select a word when seeking
         */
        that.audio_element.addEventListener('seeked', function (e) {
            that.selectCurrentWord();
            
            /**
             * Address probem with Chrome where sometimes it seems to get stuck upon seeked:
             * http://code.google.com/p/chromium/issues/detail?id=99749
             */
            var audio_element = this;
            if (!audio_element.paused) {
                var previousTime = audio_element.currentTime;
                setTimeout(function () {
                    if (!audio_element.paused && previousTime === audio_element.currentTime) {
                        console.info('unsticking');
                        audio_element.currentTime += 0.01; // Attempt to unstick
                    }
                }, 500);
            }
            
            
        });
    },
    
    _selectParentNodeUntilWord: function (node) {
        if ( !node || !this.text_element.contains(node) ){
            return null;
        }
        var is_word_node = (node.nodeType === 1 && node.dataset.index);
        if (is_word_node) {
            return node;
        }
        return this._selectParentNodeUntilWord(node.parentNode);
    }

};



// @todo Allow selection of a portion of text to have it read.  




    

