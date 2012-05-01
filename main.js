/*global ReadAlong */
window.addEventListener('load', function (e) {
    try {
        var args = {
            text_element: document.getElementById('passage-text'),
            audio_element: document.getElementById('passage-audio'),
            autofocus_current_word: document.getElementById('autofocus-current-word').checked
        };

        if (!args.audio_element.canPlayType) {
            // No error messaging is needed because error message appears in <audio> fallback
            throw new Error('HTML5 Audio not supported');
        }
        if (args.audio_element.networkState === args.audio_element.NETWORK_NO_SOURCE) {
            document.querySelector('.passage-audio-unavailable').hidden = false;
            throw new Error('Cannot play any of the available sources');
        }

        var supports_playback_rate = (function (audio) {
            if (typeof audio.playbackRate !== 'number' || isNaN(audio.playbackRate)) {
                return false;
            }

            // For Opera, since it doesn't currently support playbackRate and yet
            // has it defined as 1.0, we can detect Opera support by changing
            // the playbackRate and see if the change sticks.
            var original_playback_rate = audio.playbackRate;
            audio.playbackRate += 1.0;
            var is_playback_rate_changed = (original_playback_rate !== audio.playbackRate);
            audio.playbackRate = original_playback_rate;
            return is_playback_rate_changed;
        }(args.audio_element));

        if (supports_playback_rate) {
            var rate_range_element = document.getElementById('playback-rate');
            rate_range_element.disabled = false;
            rate_range_element.addEventListener('change', function (e) {
                args.audio_element.playbackRate = this.valueAsNumber;
            }, false);
        }
        else {
            document.querySelector('.playback-rate-unavailable').hidden = false;
        }

        ReadAlong.init(args);

        document.getElementById('autofocus-current-word').addEventListener('change', function (e) {
            ReadAlong.autofocus_current_word = this.checked;
        }, false);

        document.querySelector('.passage-audio').hidden = false;
        if (supports_playback_rate) {
            document.querySelector('.playback-rate').hidden = false;
        }
        document.querySelector('.autofocus-current-word').hidden = false;
    }
    catch (err) {
        console.error(err);
    }
    document.body.classList.add('initialized');
    document.querySelector('.loading').hidden = true;
}, false);
