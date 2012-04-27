var ReadAlong = {
    text_element: null,
    audio_element: null,
    
    words: [],
    
    current_start_word: null,
    current_end_word: null,
    current_selected_range: null,
    
    /**
     * The timeupdate Media event does not fire repeatedly enough to be
     * able to rely on for updating the selected word (it hovers around
     * 250ms resolution), so we add a setTimeout with the exact duration
     * of the word.
     */
    select_next_timeout_id: null,
    
    init: function (args) {
        var name;
        for (name in args) {
            this[name] = args[name];
        }
        
        this.generateWordList();
        this.addEventListeners();
        
        // Once set up, unhide audio player
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
        var is_next_word;
        var word = null;
        for (i = 0, len = this.words.length; i < len; i += 1) {
            is_next_word = (
                (
                    this.audio_element.currentTime >= this.words[i].begin
                    &&
                    this.audio_element.currentTime < this.words[i].end
                )
                ||
                (this.audio_element.currentTime < this.words[i].begin)
            );
            if (is_next_word) {
                word = this.words[i];
                break;
            }
        }
        return word;
    },
    
    /**
     * Select the next word that is going to be read or the word that is being read right now
     * @param {Boolean} is_automatic_advance  Whether or not the subsequent word should automatically be selected
     */
    selectNextWord: function(is_automatic_advance) {
        var next_word;
        var that = this;
        var select_word = function (is_automatic_advance) {
            that.removeWordSelection();
            next_word.element.classList.add('speaking');
            if (!is_automatic_advance) {
                var delay = Math.round( (next_word.end - that.audio_element.currentTime) * 1000 );
                clearTimeout(that.select_next_timeout_id);
                that.select_next_timeout_id = setTimeout(function () {
                    that.removeWordSelection();
                    if (!that.audio_element.paused) {
                        that.selectNextWord();
                    }
                }, delay);
            }
        };
    
        clearTimeout(this.select_next_timeout_id);
        next_word = this.getCurrentWord();
        if (next_word) {
            //Select now
            if(is_automatic_advance || that.audio_element.currentTime >= next_word.begin){
                select_word(is_automatic_advance);
            }
            //Select later
            else {
                var delay = Math.round( (next_word.begin - this.audio_element.currentTime) * 1000 );
                clearTimeout(this.select_next_timeout_id);
                this.select_next_timeout_id = setTimeout(select_word, delay);
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
         * Select next word (at that.audio_element.currentTime) when playing starts
         */
        that.audio_element.addEventListener('play', function () {
            
            var selection = window.getSelection();
            if (selection.rangeCount !== 0) {
                var range = selection.getRangeAt(0);
                var start_word_node = that.selectParentNodeUntilWord(range.startContainer);
                var end_word_node = that.selectParentNodeUntilWord(range.endContainer);
                
                var is_passage_selected = (
                    !!range
                    &&
                    !range.collapsed
                    &&
                    that.text_element.contains(range.commonAncestorContainer)
                );
                
                if (is_passage_selected) {
                    that.current_selected_range = range;
                    //selection.removeAllRanges();
                }
                //console.info(is_passage_selected, range);
        
            }
            
            that.selectNextWord();
            that.text_element.classList.add('speaking');
            
        });
        
        /**
         * Abandon seeking the next word because we're paused
         */
        that.audio_element.addEventListener('pause', function () {
            clearTimeout(that.select_next_timeout_id);
            that.text_element.classList.remove('speaking');
            
            // if there was a selection, restore it.
            if (that.current_selected_range !== null) {
                var selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(that.current_selected_range);
                that.current_selected_range = null;
            }
        });
        
        /**
         * Seek by clicking (event delegation)
         */
        that.text_element.addEventListener('click', function(e) {
            
            if (!e.target.hasAttribute('data-begin')) {
                return;
            }
            e.preventDefault();
            
            var selection = window.getSelection();
            
            that.current_start_word = e.target;
            that.current_end_word = e.target;
        
            var i = e.target.dataset.index;
            that.audio_element.currentTime = that.words[i].begin + 0.001; //Note: times apparently cannot be exactly set and sometimes select too early
            that.selectNextWord();
        });
        
        /**
         * First click handler sets currentTime to the word, and second click
         * here then causes it to play.
         * @todo Should it stop playing once the duration is over?
         */
        that.text_element.addEventListener('dblclick', function (e) {
            e.preventDefault();
            //that.audio_element.play();
        });
        
        /**
         * Select a word when seeking
         */
        that.audio_element.addEventListener('seeked', function (e) {
            that.selectNextWord(e.target.paused /* for is_automatic_advance, probably always true */);
        });
        
        that.audio_element.addEventListener('timeupdate', function (e){
            
        });
    },
    
    _selectParentNodeUntilWord: function (node) {
        if ( !node || !this.text_element.contains(node) ){
            return null;
        }
        var is_word_node = (node.nodeType === 1 && node.hasAttribute('data-begin'));
        if (is_word_node) {
            return node;
        }
        return this._selectParentNodeUntilWord(node.parentNode);
    }

};



// @todo Allow selection of a portion of text to have it read.  




    

