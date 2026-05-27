const CHARACTERS = [
  {
    id: 'akira',
    name: 'Akira',
    title: 'Cyberpunk Hacker',
    difficulty: 'Normal',
    style: 'Neon Cyberpunk',
    bio: 'A rebellious netrunner from Neo-Tokyo who wagered her gear and outfit in a high-stakes grid duel. She is confident, sharp-tongued, and plays by her own rules.',
    stages: [
      'assets/characters/akira_stage_0.png',
      'assets/characters/akira_stage_1.png',
      'assets/characters/akira_stage_2.png',
      'assets/characters/akira_stage_3.png'
    ],
    accentColor: '#00ffcc', // Cyan
    glowColor: 'rgba(0, 255, 204, 0.4)'
  },
  {
    id: 'elara',
    name: 'Elara',
    title: 'Elven Sorceress',
    difficulty: 'Hard',
    style: 'Mystic Fantasy',
    bio: 'An ancient elven wizard who wandered into the human realm. She is fascinated by human block magic (Tetris) and decided to test her focus in a playful wager.',
    stages: [
      'assets/characters/elara_stage_0.png',
      'assets/characters/elara_stage_1.png',
      'assets/characters/elara_stage_2.png',
      'assets/characters/elara_stage_3.png'
    ],
    accentColor: '#39ff14', // Neon Green
    glowColor: 'rgba(57, 255, 20, 0.4)'
  },
  {
    id: 'carmilla',
    name: 'Carmilla',
    title: 'Gothic Vampire Queen',
    difficulty: 'Easy',
    style: 'Victorian Gothic',
    bio: 'A centuries-old noble vampire who finds mortal games highly amusing. She is elegant, seductive, and enjoys watching players sweat as the blocks stack up.',
    stages: [
      'assets/characters/carmilla_stage_0.png',
      'assets/characters/carmilla_stage_1.png',
      'assets/characters/carmilla_stage_2.png',
      'assets/characters/carmilla_stage_3.png'
    ],
    accentColor: '#ff0055', // Crimson Pink
    glowColor: 'rgba(255, 0, 85, 0.4)'
  }
];

// Share globally
window.CHARACTERS = CHARACTERS;
