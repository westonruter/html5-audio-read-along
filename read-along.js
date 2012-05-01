/**
 * HTML5 Audio Read-Along
 * @author Weston Ruter, X-Team
 * @license MIT/GPL
 * https://github.com/westonruter/html5-audio-read-along
 */
var ReadAlong = {
    text_element: null,
    audio_element: null,
    autofocus_current_word: true,

    words: [],

    init: function (args) {
        var name;
        for (name in args) {
            this[name] = args[name];
        }
        this.generateWordList();
        this.addEventListeners();
        this.selectCurrentWord();
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
            word_el.tabIndex = 0; // to make it focusable/interactive
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

    _current_end_select_timeout_id: null,
    _current_next_select_timeout_id: null,

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
            if (this.autofocus_current_word) {
                current_word.element.focus();
            }
        }

        /**
         * The timeupdate Media event does not fire repeatedly enough to be
         * able to rely on for updating the selected word (it hovers around
         * 250ms resolution), so we add a setTimeout with the exact duration
         * of the word.
         */
        if (is_playing) {
            // Remove word selection when the word ceases to be spoken
            var seconds_until_this_word_ends = current_word.end - this.audio_element.currentTime; // Note: 'word' not 'world'! ;-)
            if (typeof this.audio_element === 'number' && !isNaN(this.audio_element)) {
                seconds_until_this_word_ends *= 1.0/this.audio_element.playbackRate;
            }
            clearTimeout(this._current_end_select_timeout_id);
            this._current_end_select_timeout_id = setTimeout(
                function () {
                    if (!that.audio_element.paused) { // we always want to have a word selected while paused
                        current_word.element.classList.remove('speaking');
                    }
                },
                Math.max(seconds_until_this_word_ends * 1000, 0)
            );

            // Automatically trigger selectCurrentWord when the next word begins
            var next_word = this.words[current_word.index + 1];
            if (next_word) {
                var seconds_until_next_word_begins = next_word.begin - this.audio_element.currentTime;

                var orig_seconds_until_next_word_begins = seconds_until_next_word_begins; // temp
                if (typeof this.audio_element === 'number' && !isNaN(this.audio_element)) {
                    seconds_until_next_word_begins *= 1.0/this.audio_element.playbackRate;
                }
                clearTimeout(this._current_next_select_timeout_id);
                this._current_next_select_timeout_id = setTimeout(
                    function () {
                        that.selectCurrentWord();
                    },
                    Math.max(seconds_until_next_word_begins * 1000, 0)
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
            that.selectCurrentWord();
            that.text_element.classList.add('speaking');
        }, false);

        /**
         * Abandon seeking the next word because we're paused
         */
        that.audio_element.addEventListener('pause', function (e) {
            that.selectCurrentWord(); // We always want a word to be selected
            that.text_element.classList.remove('speaking');
        }, false);

        /**
         * Seek by selecting a word (event delegation)
         */
        function on_select_word_el(e) {
            if (!e.target.dataset.begin) {
                return;
            }
            e.preventDefault();

            var i = e.target.dataset.index;
            that.audio_element.currentTime = that.words[i].begin + 0.01; //Note: times apparently cannot be exactly set and sometimes select too early
            that.selectCurrentWord();
        }
        that.text_element.addEventListener('click', on_select_word_el, false);
        that.text_element.addEventListener('keypress', function (e) {
            if ( (e.charCode || e.keyCode) === 13 /*Enter*/) {
                on_select_word_el.call(this, e);
            }
        }, false);

        /**
         * Spacebar toggles playback
         */
        document.addEventListener('keypress', function (e) {
            if ( (e.charCode || e.keyCode) === 32 /*Space*/) {
                e.preventDefault();
                if (that.audio_element.paused) {
                    that.audio_element.play();
                }
                else {
                    that.audio_element.pause();
                }
            }
        }, false);

        /**
         * First click handler sets currentTime to the word, and second click
         * here then causes it to play.
         * @todo Should it stop playing once the duration is over?
         */
        that.text_element.addEventListener('dblclick', function (e) {
            e.preventDefault();
            that.audio_element.play();
        }, false);

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
                        audio_element.currentTime += 0.01; // Attempt to unstick
                    }
                }, 500);
            }
        }, false);

        /**
         * Select a word when seeking
         */
        that.audio_element.addEventListener('ratechange', function (e) {
            that.selectCurrentWord();
        }, false);
    }
};
