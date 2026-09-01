/**
 * Exercise Video Service
 *
 * Single source of truth for exercise demo video URLs.
 * Each canonical exercise name maps to ONE direct YouTube URL
 * (or null if no video has been pinned yet).
 *
 * ─── HOW TO ADD / SWAP A VIDEO ──────────────────────────────────────
 * Find the exercise in EXERCISE_DEMO_VIDEOS below and replace its
 * value with a direct URL. Accepted formats:
 *
 *   Preferred:   'https://www.youtube.com/shorts/<videoId>'
 *   Fallback:    'https://www.youtube.com/watch?v=<videoId>'
 *   Not set:     null   (play button will be disabled)
 *
 * DO NOT use search URLs (youtube.com/results?...). The play button
 * only accepts direct video URLs.
 *
 * ─── ADDING A NEW EXERCISE ──────────────────────────────────────────
 * Append to EXERCISE_DEMO_VIDEOS with the exact canonical display
 * name used in exerciseTags.ts / exercisePools.ts. Start with null
 * if you don't have a video yet.
 *
 * ─── EXERCISES WITHOUT A DEMO (by design) ───────────────────────────
 * Zone-1 cyclical recovery modalities — they are not movements to
 * demo, so they are not in the map at all:
 *   - Light Walk or Stationary Bike
 *   - Incline Treadmill Walk
 *   - Outdoor Walk
 */

export interface ExerciseLookupResult {
  /** Direct video URL, or null when no video is pinned for this exercise. */
  url: string | null;
  /** The canonical exercise name after alias resolution. */
  canonicalName: string;
}

// ─── Direct Video URLs ─────────────────────────────────────────────
//
// Keyed by canonical display name (must match exerciseTags.ts /
// exercisePools.ts exactly). Value is a direct YouTube URL or null.
// Populate manually — do NOT use search URLs.

export const EXERCISE_DEMO_VIDEOS: Record<string, string | null> = {
  "T-Bar Tib Raises": "https://youtube.com/shorts/wRLoLlsgXLk?si=1_FC_ZIrgFjosAMU",
  "Incline Push-Up": "https://youtube.com/shorts/7f8JOu0i1cQ?si=5yAE7LhP43eJR7nX",
  "Single-Leg Hop and Stick": "https://youtube.com/shorts/ml-8WNXFJxw?si=_oGKDJbcRA66vTqC",
  "Band-Assisted Pull-Up": "https://youtube.com/shorts/pZozI1iaW0k?si=khFTBdN6N3PVZMi3",
  "Foam Roller Thoracic Extension": "https://youtube.com/shorts/9Hfy7ojEt18?si=WiIaDH0CmWP1tr-a",
  "Sleeper Stretch": "https://youtube.com/shorts/clqjaMIRWfM?si=GbVzhQVqIB8JTLBs",
  "Bench Thoracic Extension": "https://youtube.com/shorts/xE5ZaEKAx1g?si=Ylfp3Xa034vjwtZS",
  "Rotational Medicine-Ball Slam": "https://www.youtube.com/shorts/M9ryqecCLf0",
  "Medicine-Ball Slam": "https://youtube.com/shorts/fGLHGiYFIqc?si=nRpguZLephK8ZgMD",
  "Rotational Medicine-Ball Throw": "https://youtube.com/shorts/02c2YLgF8iE?si=0wuPpSMgXz_f0evm",
  "Reverse Nordic Curl": "https://youtube.com/shorts/Dd3SX08tZV4?si=wYQjogjx48LIE1xt",
  "SL 45° Back Extension Hold": "https://youtube.com/shorts/ZlAy-WUGzDA?si=5cweA9cEIvz2z5pf",
  "SL 45° Back Extension": "https://youtube.com/shorts/RpYJ3hc54eI?si=oqOiqjxkSfjvmbDa",
  "Seated Good Morning": "https://youtube.com/shorts/GycVtINbX9M?si=gEfvrD9NRfadWX2k",
  "Crab Hold": "https://youtube.com/shorts/m7-7YKIt_wM?si=2z1PTWhiwyGfDSyp",
  "Standing Knee Extension": "https://youtube.com/shorts/iJkCwL7Jivg?si=v0VQ0LOyyJYlP05p",
  "Seated Single-Leg Pike Lift": "https://youtube.com/shorts/1v-h-JQBKEY?si=xiftPU8joMStVB3l",
  "Horse Stance Hold": "https://youtube.com/shorts/4P9w2Kvgl0A?si=8tS_xXydBNaIGwcK",
  // ═══ LOWER — Squat ═══
  'Back Squat':                       'https://youtube.com/shorts/hscOjLrW60c?si=w-VfL2KXVSR8tlhX',
  'Front Squat':                      'https://youtube.com/shorts/N4WGYDGu6bI?si=ca0DyggYeEZBOAVa',
  'Box Squat':                        'https://youtube.com/shorts/jq9YxrTGvhg?si=TxggHO0TzD-15cRX',
  'Goblet Squat':                     'https://youtube.com/shorts/yTDROg8zZsU?si=2Ne2CfgFCKupJ38l',
  'Single-Leg Squat (to Box)':        'https://youtube.com/shorts/mk-lMrXRwyA?si=-2zVWLyadrwEkgCr',
  'Leg Press':                        'https://youtube.com/shorts/nDh_BlnLCGc?si=ePHOzkzXXuoDG6uQ',
  'Single-Leg Leg Press':             'https://youtube.com/shorts/LbKwZIbVYZI?si=JU_FY4giSQ5cATgs',

  // ═══ LOWER — Lunge ═══
  'Bulgarian Split Squats':           'https://youtube.com/shorts/Q20qIs79tJc?si=xHFDBgFCHEI_o5kb',
  'Walking Lunges':                   'https://youtube.com/shorts/Tc1TsAdoDRo?si=DEKYdfHr34iBgQma',
  'Reverse Lunges':                   'https://youtube.com/shorts/b_2qgdXT_QQ?si=ORVfwf8u0YjMyGoY',
  'Step Ups':                         'https://youtube.com/shorts/PzDbmqL6qo8?si=psSix8Uu_SoGY6hH',

  // ═══ LOWER — Hinge ═══
  'Deadlift':                         'https://youtube.com/shorts/vfKwjT5-86k?si=wy5FDB7Fhe0in82l',
  'Trap Bar Deadlift':                'https://youtube.com/shorts/v-SrIcAp3vM?si=NgsvLWJbCw6rz73U',
  'RDLs':                             'https://youtube.com/shorts/g5u75sgpn04?si=OXvMDpOjCaR0mP2r',
  'Single-Leg RDL':                   'https://youtube.com/shorts/R_fJ6H3FlVw?si=b9TIsBIrsFMjc0KT',
  'Hip Thrusts':                      'https://youtube.com/shorts/Kvh5yudFKyM?si=JunAi-NVT4L4SBP_',
  'Kettlebell Swings':                'https://youtube.com/shorts/jwILQCx61ts?si=EzLjxPLFrFSJs9ie',

  // ═══ LOWER — Isolation (accessory) ═══
  'Leg Extension':                    'https://youtube.com/shorts/t8--Y-pjTmg?si=361wZ-G2w94KOacA',
  'Nordic Lower':                     'https://youtube.com/shorts/wwgtGMHhS8Y?si=JHb9jqCNBGf4o6wC',
  'Calf Raises':                      'https://youtube.com/shorts/E1mG5L9rpFc?si=LkeJyI_vaFswymaQ',
  'Tib Raises':                        'https://youtube.com/shorts/pQcvW08rnAk?si=C40CUR9MTjrHCKQ8',

  // ═══ LOWER — Plyo / Power ═══
  'Box Jumps':                        'https://youtube.com/shorts/7EfeTsHZ5vk?si=n2P8e9ByOFEoVrCy',
  'Broad Jumps':                      'https://youtube.com/shorts/v0yrBWA3eEs?si=F6-nti33bKirBn1b',
  'Jump Squats':                      'https://youtube.com/shorts/36vnWAkL7ZQ?si=pMSxyvYAkr3hUcbZ',
  'Lateral Bounds':                   'https://youtube.com/shorts/Rs1zxDgyUXA?si=cukZToNM-kGFEcEe',
  'Depth Jumps':                      'https://youtube.com/shorts/V2e-wz6AIhk?si=Wo6dRhoeA8-iG1UG',

  // ═══ UPPER — Horizontal Push ═══
  'Bench Press':                      'https://youtube.com/shorts/hWbUlkb5Ms4?si=p8AusjhVLAC5ZqJk',
  'DB Bench Press':                   'https://youtube.com/shorts/Ne_9EKkUVXY?si=wKZZOtKFsAY4WUiO',
  'Incline Bench':                    'https://youtube.com/shorts/L9UKMQw1Nss?si=b0Gf95olarmdMwfc',
  'Incline DB Bench':                 'https://youtube.com/shorts/5orOHJL2qS4?si=IL8OhkIRS1hvZvFH',
  'Close Grip Bench':                 'https://youtube.com/shorts/VXJCfMES2C8?si=_JL-QquUVYfeyr_J',
  'Push-ups':                         'https://youtube.com/shorts/c-lBErfxszs?si=k01MuYu6xozOUWy9',
  'Dips':                             'https://youtube.com/shorts/Nd43B5LFtgk?si=ufBoYiEIIMAHX5wm',
  'Single-Arm DB Floor Press':        'https://youtube.com/shorts/y477pOZ_fNM?si=JriRvkiNAO9q1V_U',
  'Single-Arm DB Bench Press':        'https://youtube.com/shorts/NMes2aQzJUA?si=zMzvBM9rApj99k3J',

  // ═══ UPPER — Vertical Push ═══
  'Overhead Press':                            'https://youtube.com/shorts/DN3WXJlB1Q4?si=h4aSnpiKOUz5u3K1',
  'DB Shoulder Press':                         'https://youtube.com/shorts/b132W5N8Jrg?si=ntraNt8GsJg9qhx2',
  'Seated DB Press':                           'https://youtube.com/shorts/-lqkH31Hs10?si=vD5AVHJbeUEJgVx7',
  'Half-Kneeling Single-Arm Overhead Press':  'https://youtube.com/shorts/vpFJr1vMNQ4?si=9QQ2xTzgjYlsx1tg',
  'Landmine Press':                            'https://youtube.com/shorts/9lSi9Sflr3M?si=WPYiSYjQ3ARgWERJ',

  // ═══ UPPER — Horizontal Pull ═══
  'Barbell Row':                      'https://youtube.com/shorts/UL8ZcK64KxA?si=SDD5wMC5nxQZyKGl',
  'Chest Supported Row':              'https://youtube.com/shorts/yxpS2oMHyvA?si=J6i6PM9UvGN9_Llz',
  'Chest-Supported DB Row':           'https://youtube.com/shorts/FiQ1X4jaaCY?si=WKpfSd0qGYcR-lKp',
  'Seated Cable Row':                 'https://youtube.com/shorts/UyI7Sc7ZVdU?si=oraLYxiDnIkFzVz-',
  'Single-Arm DB Row':                'https://youtube.com/shorts/KaCcBqhiXtc?si=9QFdIUczbaxcWqs2',
  'Inverted Row (Bodyweight)':        'https://youtube.com/shorts/moG8jdcOnQQ?si=aaExGC5DIOshQa3c',

  // ═══ UPPER — Vertical Pull ═══
  'Pull-Ups':                         'https://youtube.com/shorts/dvG8B2OjfWk?si=yqgXl7NvejneCp1w',
  'Chin-Ups':                         'https://youtube.com/shorts/gibW62a_3o0?si=hcHIaeENxhRBfQ2L',
  'Chin-Up Negative (Slow)':          'https://youtube.com/shorts/F0rXGrrCP0I?si=ySzWk5UGux3aLTOg',
  'Lat Pulldown':                     'https://youtube.com/shorts/8d6d46pGdQM?si=PBNICHhLwxTKUA2c',
  'Single-Arm Lat Pulldown':          'https://youtube.com/shorts/8zA8DjHRaq0?si=ndryCAiuk2W18QXv',

  // ═══ UPPER — Power / Plyo ═══
  'Speed Bench':                      'https://youtube.com/shorts/bv1vwhBwjUY?si=qAgsG_WoYjDeX-KV',
  'Explosive Landmine Press':         'https://youtube.com/shorts/gKdmAu3yqcc?si=Wp34uZedWc7tV8m7',

  // ═══ Shoulders / Upper Back (isolation + pump) ═══
  'Lateral Raise':                    'https://youtube.com/shorts/lnVEvYCBGDo?si=c1bGR8q_pCa358Yf',
  'Face Pull':                        'https://youtube.com/shorts/1s-0WtJMsu8?si=-q1SZYXs490Tn8VH',
  'Cable Face Pull':                  'https://youtube.com/shorts/vQCi5Xzhoyw?si=fCAm2YLNsHVcEEMW',
  'Rear Delt Fly':                    'https://youtube.com/shorts/YB6aY-kCKac?si=zQ51-7Dk0tObMT1g',
  'Band Pull-Apart':                  'https://youtube.com/shorts/SuvO4TBwSu4?si=sRbHg2r4VIaRTEOc',
  'Shrugs':                           'https://youtube.com/shorts/zv50RkqKEsM?si=Rauq1r4cuaS5XvYH',
  'Single-Arm Shrug':                 'https://youtube.com/shorts/_fJM3ava3UE?si=2kwY_PAFbRJROMa0',
  'Incline Y Raise':                  'https://youtube.com/shorts/M5DeSgxNyKQ?si=8jQWHeal0gElnEwz',

  // ═══ Biceps ═══
  'Bicep Curl (Barbell)':             'https://youtube.com/shorts/N6paU6TGFWU?si=OjAUjBjn9FNEd4Z3',
  'Bicep Curl (Dumbbell)':            'https://youtube.com/shorts/iui51E31sX8?si=xEpfzceElyxcuEgn',
  'Hammer Curl':                      'https://youtube.com/shorts/VuEclXR7sZY?si=Zb-J4EvTNR4qyndp',
  'Incline Dumbbell Curl':            'https://youtube.com/shorts/8WJX5B6oR4E?si=wI86sxKdBX1LmTqN',
  'Lying Dumbbell Curl':              'https://youtube.com/shorts/Xnxt5HmlmDs?si=S_zNg_N555lq9rqh',
  'Banded Bicep Curl':                'https://youtube.com/shorts/20xtfGZ37nw?si=iPDExcmOd16KiLvj',
  'Concentration Curl':               'https://youtube.com/shorts/cHxRJdSVIkA?si=wCY9np4ZCoMTqljo',

  // ═══ Triceps ═══
  'Tricep Pushdown':                  'https://youtube.com/shorts/xguGXQAvbKk?si=cwE217VcW9OJN1_y',
  'Banded Tricep Pushdown':           'https://youtube.com/shorts/Ik1hyO3a4t0?si=EfjB0e4elwe2LSPh',
  'Skull Crushers':                   'https://youtube.com/shorts/zR9gty7LUxE?si=LomBZEO0pV6BKWC-',
  'Dumbbell Skull Crusher':           'https://youtube.com/shorts/HurmGkvE5s0?si=KytDa96NanU4fzuS',
  'Overhead Tricep Extension':        'https://youtube.com/shorts/ekEo-BSg0_U?si=VKBDNhLGmy1twEla',
  'Dumbbell Kickback':                'https://youtube.com/shorts/ZGjHc9NnJ-4?si=aXyJRxuhsVVrExqa',
  'Tricep Circuit (Dirty 30)':        'https://youtube.com/shorts/ngiSRh_rweo?si=AtoDiuDdWL2Spcdn',

  // ═══ Core / Trunk ═══
  'Band Pallof Press':                'https://youtube.com/shorts/5aZ0IhJS8O8?si=M-uhHRbHryI9VCCo',
  'Woodchop (Standing)':              'https://youtube.com/shorts/42brJJCw-OU?si=SmB3GH0Udzvx4t3w',
  'Woodchop (Half Kneeling)':         'https://youtube.com/shorts/ftQ4xaQoVKY?si=Yer5dQOQYaLlA8lk',
  'Ab Wheel':                         'https://youtube.com/shorts/QHXLnvbJ444?si=MzhlejwMTRGa4s8-',
  'Hanging Leg Raise':                'https://youtube.com/shorts/Z9ryXTU4FBQ?si=BjCrZGio1xIFEMtZ',
  'Side Plank':                       'https://youtube.com/shorts/GIDLif1n0bM?si=m1Pe-jAcQ-GogDBj',
  'Dead Bug':                         'https://youtube.com/shorts/DqLL45uk2Tk?si=n73OZqQv4HRXfHWI',
  'Banded Dead Bug':                  'https://youtube.com/shorts/bqI21ZZlB9I?si=3kFBE5MZAo_oqoFz',
  'Weighted Dead Bug':                'https://youtube.com/shorts/TzIfHL_i8k8?si=DMtDqMgaxOm0Pc0T',
  'McGill Sit Up':                    'https://youtube.com/shorts/BH5toeuGdfQ?si=ei50mNsb89tzqJfr',
  'Bird Dog':                         'https://youtube.com/shorts/algQouJmYvw?si=7XWtoried8lM7FBl',

  // ═══ Carries ═══
  'Farmer Carry':                     'https://youtube.com/shorts/UmQELGR2lws?si=BXi3NduEyfeoX8WM',
  'Suitcase Carry':                   'https://youtube.com/shorts/v8O0kNuvp_k?si=Q1qE2ZjuL-jjm7Bd',
  'Bear Carry':                       'https://youtube.com/shorts/XVDCJghr56s?si=ag2Bqh3VUPacRdr6',

  // ═══ Prehab — Groin / Adductors ═══
  'Copenhagen Plank (Half)':                 'https://youtube.com/shorts/Rwap0_j5i5A?si=t0G7VC_EHuhGD9hE',
  'Groin Squeeze':                    'https://youtube.com/shorts/Wt8y_Gagay0?si=vn3LP-2AA546wK7N',
  // No demo pinned yet — play button stays disabled. Named here so the
  // 'explosive push up' aliases resolve to a known exercise rather than dangle.
  // Sam's locked list collapses "explosive push-ups"/"Explosive Push-Ups" onto
  // this single entry; placement is owned by the power unit.
  'Explosive Push-up':                'https://youtube.com/shorts/xiSBrm-Rgms?si=nNAVvm14ukNM5Qsh',
  'Long-Lever Copenhagen':            'https://youtube.com/shorts/NBQIxbMAalk?si=nU796DqBg9LT0fSG',

  // ═══ Prehab — Calves ═══
  'Single-Leg Calf Raise':            'https://youtube.com/shorts/E1mG5L9rpFc?si=9SCBs2Vy_tt4XDU8',
  'Seated Calf Raise':                'https://youtube.com/shorts/EP6LVvotYWE?si=eih-1b4s48BzCNoh',

  // ═══ Prehab — Lower (ankle / shin) ═══

  // ═══ Prehab — Shoulder Health ═══
  'Banded External Rotation':         'https://youtube.com/shorts/7DqYesMRkzU?si=wR0oLWbHsA41Spm6',
  'Banded 90/90 External Rotation':   'https://youtube.com/shorts/PTi9pfttH64?si=cfQmGyB75VWotbcg',
  'Scap Push-Up':                     'https://youtube.com/shorts/emB58J1SyXA?si=7qFwI-rqbIoAKdpm',
  'Scap Pull Ups':                    'https://youtube.com/shorts/9M8ylnbriB0?si=8fsAN8Q8njOnH3a8',
  'Bottoms-Up KB Press':              'https://youtube.com/shorts/PDVTbKBXAl4?si=AynipcSYTa7P6Z3p',

  // ═══ Lower prehab — hamstring ═══
  'Swiss Ball Hamstring Curl':        'https://youtube.com/shorts/xB1lGVzRwWk?si=S8i01b5vzUVFGiUu',

  // ═══ Foam Rolling / Tissue Quality ═══
  'Foam Roll — Hip Flexor, Quad, Adductors': 'https://youtube.com/shorts/2pOk-jL6oTo?si=Lr8tQ1juDu4aot_m',
  'Foam Roll — T-Spine':                     'https://youtube.com/shorts/IBgT9EpudWA?si=di0sp90z6GHxfKvf',
  'Foam Roll — IT Band':                     'https://youtube.com/shorts/Sr9RWVMzyi8?si=Ghq9O_v43DzMXSNA',
  'Foam Roll — Lats':                        'https://youtube.com/shorts/QmBx0M2yzr0?si=uYR5IZSlBEGJs3Wl',
  'Foam Roll — Calves & Outer Shins':        'https://youtube.com/shorts/zn1tcngoD8U?si=EjI0Xw-pI0RF9EwQ',
  'Lacrosse Ball Glute Release':             'https://youtube.com/shorts/ILQXb8xdzA0?si=7R0q3hoNXFXglWgU',

  // ═══ Mobility ═══
  'Hip 90/90 Stretch':                'https://youtube.com/shorts/PuxmfP2Rr74?si=DC71ajSK7BS5Gvbz',
  'Cat-Cow':                          'https://youtube.com/shorts/aaTtWK7iLes?si=w1ajjFSgMLJUFVoW',
  "World's Greatest Stretch":         'https://youtube.com/shorts/BtlDLVmlBb4?si=EU_DuSJkYc4LTaKX',
  'Deep Squat Hold':                  'https://youtube.com/shorts/poKi7JPfuxE?si=wl4OGzKrfHjmq5WA',
  'Couch Stretch':                    'https://youtube.com/shorts/ktgtEWGhFd8?si=HP6gR_XVkK6IzKSs',
  'Open Book Thoracic Rotation':      'https://youtube.com/shorts/cncdlzYmbxg?si=SdAr55r4Sy1UuWZo',
  'Pigeon Stretch':                   'https://youtube.com/shorts/ePKcwMvSXs0?si=aWWkSC_hNitG80eA',
  'Adductor Rockback':                'https://youtube.com/shorts/nxuwq178gLA?si=rUq6lmvY79j8bJzD',
  'Chest / Pec Stretch (Doorway)':    'https://youtube.com/shorts/W1WcacpQ_RM?si=plHTHgnP3DpaLG_g',
  'Lat Stretch':                      'https://youtube.com/shorts/x97hAScVHHc?si=pxfE1-YrM7YFQFPC',
  'Dead Hang':                        'https://youtube.com/shorts/XPcT3capkyk?si=xwrgituNu3fzEkvT',
  'Toe Stretch':                      'https://youtube.com/shorts/xr0O6x7h5fU?si=hPO8CmkRmrwA2aXm',
  'Calf Stretch':                     'https://youtube.com/shorts/dEJgPRgsnnY?si=MZ0OZO1TfQoEprgt',

  // ═══ Recovery — Breathing / Down-Regulation ═══
  '90/90 Breathing':                  'https://youtube.com/shorts/AnvRX080sR4?si=iADGeYxT_0vtC5FL',
  'Crocodile Breathing':              'https://youtube.com/shorts/ZSkGaCxrijc?si=lL9FtZlQ8haFMSlz',
  'Box Breathing':                    'https://youtube.com/shorts/sCCQNO9C7DA?si=a6trc-rGVygN2Qvu',
  "Child's Pose with Breathing":      'https://youtube.com/shorts/Ynrg6Wsiapc?si=ONBF8XVx0MvqSitn',
  'Kneeling Jump': 'https://youtube.com/shorts/xaFQGw73peA?si=GiiYoy2aZebpMjtH',
  'Lateral Jump': 'https://youtube.com/shorts/m1JDpuGzCZw?si=alXGCw-wq5sxSuhK',
  'RFE Split Squat Jump':             'https://youtube.com/shorts/EY3bzgv2SYo?si=niQWD9Thz0mUex1d',
  'Neutral-Grip Pulldown': 'https://youtube.com/shorts/QuSqYj7tFbI?si=5lS2n9Tsohh7LPBP',
  'Overhead Carry': 'https://youtube.com/shorts/_f17ljGZWq0?si=AFi4XzPiPtMbxS3P',
  'Vertical Jump':                    'https://youtube.com/shorts/ML2Rl3KE-Gc?si=0TYIQTJsvm8XF8O6',
  'Z-Press': 'https://youtube.com/shorts/5T4Ax70UqC0?si=loaS9aL3Z1SBWPxh',

  // ═══ Sam's locked-list additions (2026-07-24) ═══
  'Banded TKE':                       'https://youtube.com/shorts/CU7Fn11YMTw?si=NTFuHD1T6G61HyzF',
  'Bodyweight Squat':                 'https://youtube.com/shorts/-5LhNSMBrEs?si=4BjCCOFx_gWNWVgc',
  'Bosch Hold':                       'https://youtube.com/shorts/WIrkq7Kd6E8?si=uFJoVmzBX2MH-0hR',
  'Glute Bridge':                     'https://youtube.com/shorts/mSuDY5J0Fwo?si=lbES-sNynf1nzRuV',
  'Hamstring Curl':                   'https://youtube.com/shorts/EfeVvA1vdd4?si=M68PVv0bXBYICDQv',
  'Hollow Hold':                      'https://youtube.com/shorts/pN_YFk4Lx8Q?si=BGSE18ha_P1JsxFs',
  'Plank':                            'https://youtube.com/shorts/hoeNgjheDHk?si=urWIrNWTSgdpU5KI',
  'Pogo Hops':                        'https://youtube.com/shorts/SjHRwhGXBl8?si=RzqJnRFhEhHjBzJO',
  'Side Plank Row':                   'https://youtube.com/shorts/h3EfXtxlonY?si=a95V7UuE-47T6-SB',
  'Single-Leg Hip Thrust':            'https://youtube.com/shorts/bRZeB6UG6Js?si=w4SjRdY3L96gu-gQ',
  'Slant Board Step-Down':            'https://youtube.com/shorts/Y7-m2oSUEJQ?si=bQDAKrpodIuBTJNp',
  'Spanish Squat Hold':               'https://youtube.com/shorts/UKXVgo4jfkw?si=zR6WD7rBjbFSi0X0',
  'Stir the Pot':                     'https://youtube.com/shorts/TojWydRDiHY?si=Fx3Nqse-BBWn6keC',
  'Back Extension':                   'https://youtube.com/shorts/d-S2VfpRL_I?si=fCBFbXBVXXToQuXG',
  'Crab Walks':                       'https://youtube.com/shorts/yItH_robbcU?si=yWEx-UIvVnLW3rMM',
  'Dragon Flag':                      'https://youtube.com/shorts/mL-_0xacP_8?si=0gB_ZXpgJYeTfu7F',
  'High Box Squat':                   'https://youtube.com/shorts/oFSJ13d3Hc4?si=WMBzS7_HeL_-c1tu',
  'Speed Trap Bar Deadlift':          'https://youtube.com/shorts/0ZfQDDiI1Hs?si=b3Pt-cMT8VU9LsRt',
  'QL Back Extension':                'https://youtube.com/shorts/MVu18rxmukk?si=F8L_pi2vYToxg8rb',
  'ATG Split Squat':                  'https://youtube.com/shorts/7Adg7R5BknU?si=SAfVIuE7G2HpJ-pR',
  'Elephant Walks':                   'https://youtube.com/shorts/GMYMWEkki6U?si=eFuoyRDoDux_QhHW',
  'Cossack Squat':                    'https://youtube.com/shorts/MJvazUpmdZU?si=I8QDr6TOUMUWEtN6',
  'Lateral Lunge':                    'https://youtube.com/shorts/5JPYr0JEFtY?si=OxHmKfhzZ_GApjoY',
  // Sam's authored mobility additions (2026-07-28).
  'Butterfly Stretch':                'https://youtube.com/shorts/oO_Y-r72Kj4?si=hGR47gGVVQw5ofo-',
  'Pissing Dog Against Wall':         'https://youtube.com/shorts/dSbrnhnkZwY?si=q928QMcTGEXM2WlE',
  'Jefferson Curl':                   'https://youtube.com/shorts/BlYDql9MvBU?si=fwnMBJV81r9fwnlB',
  'Dumbbell Pullovers':               'https://youtube.com/shorts/QoLckcLvNB0?si=oWGDGXzDprOJSwWx',
};

// ─── Name Normalisation ────────────────────────────────────────────
//
// Coach/AI prompts sometimes use shorthand. Normalise to canonical
// display names so EXERCISE_DEMO_VIDEOS lookups hit. Keys lowercase.

const EXERCISE_NAME_ALIASES: Record<string, string> = {
  // Lower — squat
  'squat':                            'Back Squat',
  'barbell squat':                    'Back Squat',
  'bb squat':                         'Back Squat',
  'back squats':                      'Back Squat',
  'front squats':                     'Front Squat',
  'box squats':                       'Box Squat',
  'high box squat':                   'Box Squat',
  'high box back squat':              'Box Squat',
  'speed box squat':                  'Box Squat',
  'speed box squats':                 'Box Squat',
  'goblet squats':                    'Goblet Squat',
  'single leg squat':                 'Single-Leg Squat (to Box)',
  'single leg squat to box':          'Single-Leg Squat (to Box)',
  'pistol squat':                     'Single-Leg Squat (to Box)',

  // Lower — lunge
  'bulgarian split squat':            'Bulgarian Split Squats',
  'rfe split squat':                  'Bulgarian Split Squats',
  'rfe split squats':                 'Bulgarian Split Squats',
  'walking lunge':                    'Walking Lunges',
  'reverse lunge':                    'Reverse Lunges',
  'step up':                          'Step Ups',

  // Lower — hinge
  'tb deadlift':                      'Trap Bar Deadlift',
  'tb deads':                         'Trap Bar Deadlift',
  'hex bar deadlift':                 'Trap Bar Deadlift',
  'rdl':                              'RDLs',
  'romanian deadlift':                'RDLs',
  'single leg rdl':                   'Single-Leg RDL',
  'single leg deadlift':              'Single-Leg RDL',
  'hip thrust':                       'Hip Thrusts',
  'leg extension':                    'Leg Extension',
  'leg extensions':                   'Leg Extension',
  'machine leg extension':            'Leg Extension',
  'knee extension':                   'Leg Extension',
  'quad extension':                   'Leg Extension',
  'nordic':                           'Nordic Lower',
  'nordic curl':                      'Nordic Lower',
  'nordic curls':                     'Nordic Lower',
  'nordics':                          'Nordic Lower',
  'nordic lower':                     'Nordic Lower',
  'nordic lowers':                    'Nordic Lower',
  'nordic ham curl':                  'Nordic Lower',
  'nordic hamstring curl':            'Nordic Lower',
  'kb swing':                         'Kettlebell Swings',
  'kb swings':                        'Kettlebell Swings',
  'kettlebell swing':                 'Kettlebell Swings',

  // Lower — plyo
  'box jump':                         'Box Jumps',
  'broad jump':                       'Broad Jumps',
  'squat jump':                       'Jump Squats',
  'jump squat':                       'Jump Squats',
  'lateral bound':                    'Lateral Bounds',
  'depth jump':                       'Depth Jumps',

  // Upper — push
  'bench':                            'Bench Press',
  'flat bench':                       'Bench Press',
  'barbell bench press':              'Bench Press',
  'db bench':                         'DB Bench Press',
  'dumbbell bench press':             'DB Bench Press',
  'flat db bench':                    'DB Bench Press',
  'flat db press':                    'DB Bench Press',
  'incline bench press':              'Incline Bench',
  'incline db press':                 'Incline DB Bench',
  'incline dumbbell press':           'Incline DB Bench',
  'push up':                          'Push-ups',
  'push ups':                         'Push-ups',
  'pushup':                           'Push-ups',
  'pushups':                          'Push-ups',
  'dip':                              'Dips',
  'tricep dips':                      'Dips',
  'db overhead press':                'DB Shoulder Press',
  'overhead db press':                'DB Shoulder Press',
  'military press':                   'Overhead Press',
  'bb overhead press':                'Overhead Press',
  'seated db press':                  'Seated DB Press',
  'seated overhead press':            'Seated DB Press',
  'seated db overhead press':         'Seated DB Press',
  'half kneeling sa ohp':                 'Half-Kneeling Single-Arm Overhead Press',
  'half-kneeling sa overhead press':      'Half-Kneeling Single-Arm Overhead Press',
  'half-kneeling single arm overhead press': 'Half-Kneeling Single-Arm Overhead Press',
  'half kneeling single arm overhead press': 'Half-Kneeling Single-Arm Overhead Press',
  'half-kneeling single-arm press':       'Half-Kneeling Single-Arm Overhead Press',
  'half kneeling single-arm press':       'Half-Kneeling Single-Arm Overhead Press',
  'explosive push up':                'Explosive Push-up',
  'explosive push ups':               'Explosive Push-up',
  'explosive push-ups':               'Explosive Push-up',
  'explosive pushup':                 'Explosive Push-up',
  'explosive pushups':                'Explosive Push-up',

  // Upper — pull
  'pull up':                          'Pull-Ups',
  'pull ups':                         'Pull-Ups',
  'pullup':                           'Pull-Ups',
  'pullups':                          'Pull-Ups',
  'chin up':                          'Chin-Ups',
  'chin ups':                         'Chin-Ups',
  'chinup':                           'Chin-Ups',
  'chinups':                          'Chin-Ups',
  'bb row':                           'Barbell Row',
  'barbell rows':                     'Barbell Row',
  'bent over row':                    'Barbell Row',
  'bent over barbell row':            'Barbell Row',
  'bent bb row':                      'Barbell Row',
  'single arm dumbbell row':          'Single-Arm DB Row',
  'single arm db row':                'Single-Arm DB Row',
  'single arm db row on bench':       'Single-Arm DB Row',
  'db row':                           'Single-Arm DB Row',
  'db rows':                          'Single-Arm DB Row',
  'incline db row':                   'Chest-Supported DB Row',
  'incline dumbbell row':             'Chest-Supported DB Row',
  'single arm lat pulldown':          'Single-Arm Lat Pulldown',
  'single-arm pulldown':              'Single-Arm Lat Pulldown',
  'single arm pulldown':              'Single-Arm Lat Pulldown',
  'one-arm lat pulldown':             'Single-Arm Lat Pulldown',
  'unilateral lat pulldown':          'Single-Arm Lat Pulldown',

  // Arms / shoulders / core
  'lateral raises':                   'Lateral Raise',
  'db lateral raise':                 'Lateral Raise',
  'dumbbell lateral raise':           'Lateral Raise',
  'side lateral raise':               'Lateral Raise',
  'face pull':                        'Face Pull',
  'face pulls':                       'Face Pull',
  'face pull cable':                  'Cable Face Pull',
  'cable face pull':                  'Cable Face Pull',
  'rear delt flyes':                  'Rear Delt Fly',
  'rear delt flys':                   'Rear Delt Fly',
  'band pull apart':                  'Band Pull-Apart',
  'band pull aparts':                 'Band Pull-Apart',
  'band pull-aparts':                 'Band Pull-Apart',
  'shrug':                            'Shrugs',
  'dumbbell shrugs':                  'Shrugs',
  'db shrugs':                        'Shrugs',
  'bb shrugs':                        'Shrugs',
  'barbell shrugs':                   'Shrugs',
  'single arm shrug':                 'Single-Arm Shrug',
  'single-arm shrugs':                'Single-Arm Shrug',
  'single arm shrugs':                'Single-Arm Shrug',
  'y raise':                          'Incline Y Raise',
  'incline y raises':                 'Incline Y Raise',
  'barbell curl':                     'Bicep Curl (Barbell)',
  'barbell curls':                    'Bicep Curl (Barbell)',
  'bb curl':                          'Bicep Curl (Barbell)',
  'ez bar curl':                      'Bicep Curl (Barbell)',
  'bicep curl':                       'Bicep Curl (Dumbbell)',
  'bicep curls':                      'Bicep Curl (Dumbbell)',
  'db curls':                         'Bicep Curl (Dumbbell)',
  'dumbbell bicep curl':              'Bicep Curl (Dumbbell)',
  'hammer curls':                     'Hammer Curl',
  'incline db curls':                 'Incline Dumbbell Curl',
  'incline dumbbell curls':           'Incline Dumbbell Curl',
  'incline db curl':                  'Incline Dumbbell Curl',
  'lying db curl':                    'Lying Dumbbell Curl',
  'lying dumbbell curls':             'Lying Dumbbell Curl',
  'banded curl':                      'Banded Bicep Curl',
  'band curl':                        'Banded Bicep Curl',
  'concentration curls':              'Concentration Curl',
  'skull crusher':                    'Skull Crushers',
  'db skull crusher':                 'Dumbbell Skull Crusher',
  'dumbbell skull crushers':          'Dumbbell Skull Crusher',
  'overhead tricep ext':              'Overhead Tricep Extension',
  'overhead tricep extensions':       'Overhead Tricep Extension',
  'db kickback':                      'Dumbbell Kickback',
  'dumbbell kickbacks':               'Dumbbell Kickback',
  'tricep kickback':                  'Dumbbell Kickback',
  'tricep kickbacks':                 'Dumbbell Kickback',
  'tricep pushdowns':                 'Tricep Pushdown',
  'rope pushdown':                    'Tricep Pushdown',
  'rope tricep pushdown':             'Tricep Pushdown',
  'banded tricep pushdowns':          'Banded Tricep Pushdown',
  'dirty 30':                         'Tricep Circuit (Dirty 30)',
  'pallof':                           'Band Pallof Press',
  'pallof press':                     'Band Pallof Press',
  'woodchop':                         'Woodchop (Standing)',
  'woodchops':                        'Woodchop (Standing)',
  'standing woodchop':                'Woodchop (Standing)',
  'cable woodchop':                   'Woodchop (Standing)',
  'cable woodchops':                  'Woodchop (Standing)',
  'cable or band woodchop':           'Woodchop (Standing)',
  'half-kneeling cable chop':         'Woodchop (Half Kneeling)',
  'half kneeling cable chop':         'Woodchop (Half Kneeling)',
  'half-kneeling chop':               'Woodchop (Half Kneeling)',
  'half kneeling chop':               'Woodchop (Half Kneeling)',
  'half-kneeling cable or band chop': 'Woodchop (Half Kneeling)',
  'half-kneeling woodchop':           'Woodchop (Half Kneeling)',
  'half kneeling woodchop':           'Woodchop (Half Kneeling)',
  'cable chop':                       'Woodchop (Standing)',
  'cable chops':                      'Woodchop (Standing)',
  'cable lift':                       'Woodchop (Half Kneeling)',
  'cable lifts':                      'Woodchop (Half Kneeling)',
  'half-kneeling cable lift':         'Woodchop (Half Kneeling)',
  'half kneeling cable lift':         'Woodchop (Half Kneeling)',
  'low to high cable lift':           'Woodchop (Half Kneeling)',
  'ab rollout':                       'Ab Wheel',
  'ab wheel rollout':                 'Ab Wheel',
  'hanging leg raises':               'Hanging Leg Raise',
  'leg raise':                        'Hanging Leg Raise',
  'dead bug':                         'Dead Bug',
  'dead bugs':                        'Dead Bug',
  'banded dead bug':                  'Banded Dead Bug',
  'banded dead bugs':                 'Banded Dead Bug',
  'weighted dead bug':                'Weighted Dead Bug',
  'weighted dead bugs':               'Weighted Dead Bug',
  'mcgill sit up':                    'McGill Sit Up',
  'mcgill situp':                     'McGill Sit Up',
  'mcgill sit-up':                    'McGill Sit Up',
  'mcgill curl up':                   'McGill Sit Up',
  'mcgill curl-up':                   'McGill Sit Up',
  'bird dog':                         'Bird Dog',
  'bird dogs':                        'Bird Dog',
  'side plank':                       'Side Plank',
  'side planks':                      'Side Plank',
  'farmer carry':                     'Farmer Carry',
  'farmers carry':                    'Farmer Carry',
  'farmers walk':                     'Farmer Carry',
  'farmer walk':                      'Farmer Carry',
  'suitcase carry':                   'Suitcase Carry',
  'suitcase carries':                 'Suitcase Carry',
  'bear carry':                       'Bear Carry',
  'bear carries':                     'Bear Carry',
  'bear hug carry':                   'Bear Carry',
  'foam roll quads':                  'Foam Roll — Hip Flexor, Quad, Adductors',
  'foam roll — quads':                'Foam Roll — Hip Flexor, Quad, Adductors',
  'foam roll quads, glutes & adductors': 'Foam Roll — Hip Flexor, Quad, Adductors',
  'foam roll lower':                  'Foam Roll — Hip Flexor, Quad, Adductors',
  'foam roll t-spine':                'Foam Roll — T-Spine',
  'foam roll thoracic':               'Foam Roll — T-Spine',
  'foam roll thoracic spine':         'Foam Roll — T-Spine',
  'foam roll thoracic spine & lats':  'Foam Roll — T-Spine',
  'foam roll upper':                  'Foam Roll — T-Spine',
  'foam roll it band':                'Foam Roll — IT Band',
  'foam roll lats':                   'Foam Roll — Lats',
  'foam roll calves':                 'Foam Roll — Calves & Outer Shins',
  'pec doorway stretch':              'Chest / Pec Stretch (Doorway)',
  'chest doorway stretch':            'Chest / Pec Stretch (Doorway)',
  'pec / chest doorway stretch':      'Chest / Pec Stretch (Doorway)',
  'doorway pec stretch':              'Chest / Pec Stretch (Doorway)',
  'couch stretch':                    'Couch Stretch',
  'couch stretch (hip flexor)':       'Couch Stretch',
  'lat stretch':                      'Lat Stretch',
  'dead hang':                        'Dead Hang',
  'bar hang':                         'Dead Hang',
  'toe stretch':                      'Toe Stretch',
  'calf stretch':                     'Calf Stretch',

  // Prehab
  'tib raise':                        'Tib Raises',
  'tib raises':                       'Tib Raises',
  'tibialis raises':                  'Tib Raises',
  'external rotation':                'Banded External Rotation',
  'band external rotation':           'Banded External Rotation',
  'banded external rotation':         'Banded External Rotation',
  'shoulder external rotation':       'Banded External Rotation',
  'banded 90/90 external rotation':   'Banded 90/90 External Rotation',
  '90/90 external rotation':          'Banded 90/90 External Rotation',
  'standing calf raise':              'Calf Raises',
  'standing calf raises':             'Calf Raises',
  'single leg calf raise':            'Single-Leg Calf Raise',
  'calf raise':                       'Single-Leg Calf Raise',
  'bent leg calf raise':              'Seated Calf Raise',
  'copenhagen plank':                 'Copenhagen Plank (Half)',
  'short lever copenhagen':           'Copenhagen Plank (Half)',
  'short-lever copenhagen':           'Copenhagen Plank (Half)',
  'long lever copenhagen':            'Long-Lever Copenhagen',
  'long-lever copenhagen':            'Long-Lever Copenhagen',
  'bottoms up press':                 'Bottoms-Up KB Press',
  'bottoms-up press':                 'Bottoms-Up KB Press',
  'bottoms up kb press':              'Bottoms-Up KB Press',
  'bottoms-up kb press':              'Bottoms-Up KB Press',
  'scap push-up':                     'Scap Push-Up',
  'scap push up':                     'Scap Push-Up',
  'scapular push-up':                 'Scap Push-Up',
  'scapular push up':                 'Scap Push-Up',
  'inverted row':                     'Inverted Row (Bodyweight)',
  'bodyweight row':                   'Inverted Row (Bodyweight)',
};

/**
 * Resolve an input name (potentially shorthand) to its canonical
 * display name in EXERCISE_DEMO_VIDEOS.
 */
function resolveCanonicalName(input: string): string {
  const trimmed = input.trim();
  if (trimmed in EXERCISE_DEMO_VIDEOS) return trimmed;

  const lower = trimmed.toLowerCase();
  if (EXERCISE_NAME_ALIASES[lower]) return EXERCISE_NAME_ALIASES[lower];

  // Strip trailing 's' for simple plural variants (box jumps → box jump)
  if (lower.endsWith('s') && EXERCISE_NAME_ALIASES[lower.slice(0, -1)]) {
    return EXERCISE_NAME_ALIASES[lower.slice(0, -1)];
  }

  return trimmed;
}

/**
 * Look up the pinned demo video for an exercise.
 *
 * Returns the direct URL if one is pinned, otherwise null.
 * NEVER returns a search URL — if no video is pinned, the caller
 * must handle the null case (e.g. disable the play button).
 */
export function lookupExerciseDemo(exerciseName: string): ExerciseLookupResult {
  const canonical = resolveCanonicalName(exerciseName);
  const pinned = EXERCISE_DEMO_VIDEOS[canonical] ?? null;

  return {
    url: pinned,
    canonicalName: canonical,
  };
}

/**
 * Convenience: does this exercise have a pinned demo video?
 */
export function hasExerciseDemo(exerciseName: string): boolean {
  return lookupExerciseDemo(exerciseName).url !== null;
}

// ─── Inline Playback Helpers ─────────────────────────────────────────
//
// These helpers convert the pinned canonical URLs (always YouTube Shorts
// today) into an embeddable iframe URL so the modal can play inline via
// WebView instead of punting the user to the YouTube app.
//
// Shorts URL shape: https://youtube.com/shorts/<videoId>?si=<tracking>
// Embed URL shape:  https://www.youtube-nocookie.com/embed/<videoId>?<params>
//
// If a future URL format is introduced (full youtube.com/watch, youtu.be,
// etc.) extractYouTubeVideoId handles it, and buildYouTubeEmbedUrl stays
// unchanged — the only change surface is the matcher below.

const YT_ID_PATTERNS: RegExp[] = [
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i,   // https://youtube.com/shorts/<id>
  /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i,    // https://youtube.com/embed/<id>
  /youtube\.com\/watch\?[^#]*?v=([A-Za-z0-9_-]{6,})/i, // https://youtube.com/watch?v=<id>
  /youtu\.be\/([A-Za-z0-9_-]{6,})/i,              // https://youtu.be/<id>
];

/**
 * Pull the YouTube video id out of any supported URL shape. Returns
 * null when the URL isn't a YouTube link we know how to embed — the
 * caller should then render the external-link fallback.
 */
export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  for (const pattern of YT_ID_PATTERNS) {
    const m = url.match(pattern);
    if (m && m[1]) return m[1];
  }
  return null;
}

/**
 * Build an iframe-ready YouTube embed URL from a video id.
 *
 *   - youtube-nocookie.com: privacy-enhanced embed host.
 *   - playsinline=1:        iOS refuses inline playback without this.
 *   - rel=0:                hide "more videos" at end.
 *   - modestbranding=1:     reduce YouTube chrome.
 *   - controls=1:           keep native play/pause/scrub controls.
 *   - fs=1:                 allow full-screen button (user can escalate
 *                           if they want the big view).
 *   - iv_load_policy=3:     suppress video annotations.
 *   - enablejsapi=1:        let the modal use YouTube's supported player API
 *                           to establish its muted default.
 *
 * We intentionally DO NOT autoplay — iOS/Android both block autoplay
 * with sound until a user gesture, and a muted auto-play would be worse
 * UX than letting the athlete tap the play button on the iframe itself.
 */
export function buildYouTubeEmbedUrl(videoId: string): string {
  const params = [
    'playsinline=1',
    'rel=0',
    'modestbranding=1',
    'controls=1',
    'fs=1',
    'iv_load_policy=3',
    'enablejsapi=1',
  ].join('&');
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}
