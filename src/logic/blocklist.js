// Words that are never used in puzzles and never shown as a hint. They are still accepted if a player types them
// (the guess list is the whole ENABLE list), we just do not put them on screen ourselves. Lengths 3-5 only.
export const BLOCKLIST = new Set((
  'ass cum fag gyp hos jew pee poo pus sex tit wop yid ' +
  'anal anus arse bong boob butt clit cock coon crap cums cunt dago damn dick dong dyke fags fart fuck gook hell homo jews jism jizz kike ' +
  'kill lust mick nazi nude orgy piss pimp poop porn pube puke rape scum sexy shag shit slut smut spic suck tits turd twat wank wops yids ' +
  'bimbo bitch boner boobs booby booze busty butts chink cocks coons craps cunts dagos darky dicks dildo drunk dykes fanny farts feces ' +
  'fucks gooks gypsy hells homos horny hussy jewed kikes kills kinky lusts moron nazis negro nudes nudie orgys penis pimps pissy poops ' +
  'porno porns porny prick pubes pukes pussy queer randy raped raper rapes scums semen sexed sexes shags shite shits sissy skank sluts ' +
  'smuts spics spunk sucks titty turds twats vodka vulva wanks whore'
).split(' '))

export const isBlocked = (w) => BLOCKLIST.has(w)
