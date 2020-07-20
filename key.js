{
  const nbits = 8;
  const nmods = 5;

  const cmask = (1 << nbits) - 1;
  const mmask = ((1 << nmods) - 1) << nbits;
  const mask  = cmask | mmask;

  window.Key = class Key
  {
    #code;

    constructor (code = 0)
    {
      this.#code = code & mask;
    }

    get code ( ) { return this.#code; }
    set code (v) { return this.#code = v; }

    get key  ( ) { return this.#code & cmask; }
    get mods ( ) { return this.#code & mmask; }

    set key  (v) { return this.#code = this.mods | v; }
    set mods (v) { return this.#code = this.char | v; }

    // ------

    getBit (i)    { return this.#code & (1 << i); }
    setBit (i, v) {
      this.#code &= mask ^ (1 << i);
      this.#code |= (Boolean(v) & 1) << i;
      return this.#code;
    }

    get shift ( ) { return this.getBit (nbits + 0); }
    get ctrl  ( ) { return this.getBit (nbits + 1); }
    get alt   ( ) { return this.getBit (nbits + 2); }
    get meta  ( ) { return this.getBit (nbits + 3); }
    get lower ( ) { return this.getBit (nbits + 4); }

    set shift (v) { return this.setBit (nbits + 0, v); }
    set ctrl  (v) { return this.setBit (nbits + 1, v); }
    set alt   (v) { return this.setBit (nbits + 2, v); }
    set meta  (v) { return this.setBit (nbits + 3, v); }
    set lower (v) { return this.setBit (nbits + 4, v); }

    // -------

    isLetter ()
    {
      return this.key >= 65 && this.key <= 90;
    }

    getChar ()
    {
      let c = this.key;
      if (this.lower && !this.shift) c ^= 0x20;
      return String.fromCharCode (c);
    }

  };
}

{
  // The window.onkeypress event have correct keycodes, but only fires on letters.
  //
  // window.onkeydown always return keycodes corresponding to uppercase letters.
  // Suppose we recieve the keycode 65 (A). This could be any of the following:
  //
  // | Physical key | Capslock | Shift | Result |
  // |--------------|----------|-------|--------|
  // | a            | No       | No    | a      |
  // | a            | No       | Yes   | A      |
  // | a            | Yes      | No    | A      |
  // | a            | Yes      | Yes   | a      |
  // | A            | No       | No    | A      |
  // | A            | No       | Yes   | a      |
  // | A            | Yes      | Yes   | A      |
  // | A            | Yes      | No    | a      |
  //
  // window.onkeydown will give keycodes that overlap with the lowercase letters.
  // For instance, F1-F12 are 112-123, but should be 190-202.
  //
  // The '.key' string given by window.onkeydown have correct casing.
  //
  // We can detect wether shift is pressed.
  //
  // We have no way to reliably detect capslock- we are forced to
  // consider 'a+capslock' as identical to A.
  //
  // Thus, we know the last two colums of the table above, and can ignore the second:
  //
  // | Physical key | Shift | Result |
  // |--------------|-------|--------|
  // | a            | No    | a      |
  // | a            | Yes   | A      |
  // | A            | No    | A      |
  // | A            | Yes   | a      |
  //
  // It would be possible for us to write a translation table to get
  // correct behavior (lowercase letters are 97-122), but I'd really
  // rather not!
  //
  // Instead, we pretend that there are only uppercase letters,
  // and add a fictional 'lowercase' modifier key.
  //
  // That is: 'lower+A == a' and there is no 'a' key

  function keyEventToKey (ev)
  {
    const k = new Key (ev.keyCode);

    k.shift = ev.shiftKey;
    k.ctrl  = ev.ctrlKey;
    k.alt   = ev.altKey;
    k.meta  = ev.metaKey;

    // onkeydown always return uppercase letters.
    if (k.isLetter ())
    {
      // But the string '.key' seems to have correct casing
      const chr = ev.key.charCodeAt(0);

      // Javascript have fictional keycodes that overlap with the lowercase
      // letters- we add a fictional lowercase modifier key
      const upper = Boolean (chr & 0x20);

      if (upper != ev.shiftKey)
        k.lower = true;
    }

    return k;
  }

  // In my browser (chrome 7X), for most keys 'ev.repat' is always false.
  // Instead, when I hold a key down I get both a 'keydown' and a 'keyup' event
  // for every repetition.
  //
  // My keyrepeat settings is:
  //   xset r rate 160 80
  //   # When a key is held down, wait 160ms, then repeat at 80hz.
  //
  // Output:
  //   down: 3054.66
  //   up:   3215.26 (3215 - 3054 = 161, expected 160)
  //
  //   down: 3215.85
  //   up:   3227.89 (3227 - 3215 = 12, expected 12.5)
  //   down: 3228.48
  //   up:   3240.34
  //   down: 3241.01
  //   up:   3252.69
  //   down: 3253.00
  //   up:   3264.62
  //
  // This is true for: letters, space, period, comma, arrow keys, enter.
  // It is false for:  F1-F12, shift, ctrl
  //
  // My guess is that it is true for any key that would produce a letter if
  // typed into a textbox.
  //
  // There seems to be less than 1ms between 'up' followed by 'down' events-
  // no human can press a key 1000 times a second, so we can safely assume
  // this must be key repeat.
  //
  // It is also safe to raise this limit a bit. Someone else might have a
  // slow-ass computer where there are less than 2ms between 'up' and 'down',
  // and since no human can press a key at 500hz either, this is also key repeat.
  //
  // How high are we willing to raise this limit though?
  //
  // Reasoning:
  //   To distinguish repeat from press we must sit around and wait.
  //   We are creating a game.
  //   My monitor runs at 60hz.
  //
  //   Therefor it is unacceptable to wait for more than (1000/60)ms,
  //   as this would result in the user having to wait for a full frame
  //   to see their input reflected on the screen.
  //
  //   Is it reasonable to expect a human to be able to spam a key at
  //   60hz? No! but I'd say it is borderline possible.
  //
  //   Fortunately there are prople who have faster computers than me-
  //   there are 120hz monitors and even faster!
  //
  //   Can a human spam a key at 120hz? Absolutely not!
  //
  //   Wikipedia says there are 240hz monitors.
  //
  //   I choose the number 250 because it is divisible by 1000 =>
  //     we get a clean 4ms graze period

  const waiting = {};

  window.onkeydown = function (ev)
  {
    const k = keyEventToKey (ev);
    const c = k.code;
    const t = ev.timeStamp;

    if (c in waiting)
    {
      clearTimeout(waiting[c]);
      delete waiting[c];
      return myKeyDown (k, t, true);
    }

    return myKeyDown (k, t, false);
  };
  window.onkeyup = function (ev)
  {
    const k = keyEventToKey (ev);
    const c = k.code;
    const t = ev.timeStamp;

    waiting[c] =
      setTimeout (_ => { delete waiting[c]; myKeyUp (k, t); }, 4);

    return false;
  };

  // down:   6862.26
  // repeat: 7021.65 (159)
  //
  // repeat: 7034.38 (13)
  // repeat: 7045.17 (11)
  // repeat: 7058.41 (13)
  // repeat: 7070.65 (12)
  // repeat: 7084.36 (14)
  // repeat: 7096.09 (12)
  // up:     7099.58 (3)

  function myKeyDown (k, t, r) {
    if (window.keydown)
      return window.keydown(k,t,r);
  }
  function myKeyUp (k, t) {
    if (window.keyup)
      return window.keyup(k,t);
  }

  // ----------------

  const names =
    { "bs":        8
    , "backspace": 8
    , "tab":       9
    , "cr":        13
    , "return":    13
    , "enter":     13
    , "caps":      20
    , "esc":       27
    , "escape":    27
    , "pgup":      33
    , "pgdown":    34
    , "end":       35
    , "home":      36
    , "left":      37
    , "up":        38
    , "right":     39
    , "down":      40
    , "f1":        112
    , "f2":        113
    , "f3":        114
    , "f4":        115
    , "f5":        116
    , "f6":        117
    , "f7":        118
    , "f8":        119
    , "f9":        120
    , "f10":       121
    , "f11":       122
    , "f12":       123
    }

  // Foo         -> F, o, o
  // <esc>       -> Escape
  // <c-f>oo     -> ctrl+f, o, o
  // <c-a-m-esc> -> ctrl+alt+meta+escape

  window.parseKeys = function (str)
  {
    const res = [];

    for (let i = 0; i < str.length; i++)
    {
      const chr  = str[i];
      const code = str.charCodeAt(i);

      if ( (code >= 65 && code <=  90) // lowercase letter
        || (code >= 97 && code <= 122) // uppercase letter
         )
      {
        const k = new Key (code & 0xdf);
        k.lower = code & 0x20;
        res.push (k);
        continue;
      }

      if (chr != '<')
      {
        res.push (new Key(code));
        continue;
      }

      let left = i; // opening <
      for (; i < str.length && str[i] != '>'; i++);
      let right = i - 1; // closing >

      // unmatched < or <>, assume literal <
      if (str[i] != '>' || left == right)
      {
        res.push (new Key (60));
        i = left;
        continue;
      }

      left++;

      // j = final -
      let j = left + 1;
      for (; j < right && str[j] == '-'; j+=2);
      j -= 2;


      let word = str.substr(j+1,right-j);
      let k;

      if (word.length == 1)
      {
        k = parseKeys(word)[0];
      }
      else if (word.length == 2 && j == left-1)
      {
        // <x->, assume <
        res.push (new Key (60));
        i = j;
        continue;
      }
      else
      {
        word = word.toLowerCase();

        if (!(word in names))
        {
          console.error("Unknown key: <" + word + ">")
          return false;
        }

        k = new Key (names[word]);
      }

      for (let u = left; u < j; u+=2)
      {
        switch (str[u].toLowerCase())
        {
          case 'c': k.ctrl  = true; break;
          case 'a': k.alt   = true; break;
          case 'm': k.meta  = true; break;
          case 's': k.shift = true; break;
          default:
            console.error("Unknown modifier: " + str[u])
            return false;
        }
      }

      res.push (k);
    }

    return res;
  };
}

