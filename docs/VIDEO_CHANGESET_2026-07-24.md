# Video Changeset — Sam's authored pass (2026-07-24)

Source: Sam's edited video audit sheet, parsed verbatim. Applies to
src/services/exerciseVideoService.ts EXERCISE_DEMO_VIDEOS (after the cue
changeset's renames/deletions). 36 URLs below are Sam's picks — apply
EXACTLY, keep ?si= params as given.

## Set / replace (41)

Amended 2026-07-24: the original 36 plus five added when applying the changeset
surfaced real gaps — see "Still no video" below.

- **Abductor Machine**: https://youtube.com/shorts/S_FGYHNHJ_c?si=Wqz3kGC0csTyr5Lh
- **Ab Wheel**: https://youtube.com/shorts/QHXLnvbJ444?si=MzhlejwMTRGa4s8-
- **Adductor Machine**: https://youtube.com/shorts/iPLvw74e7Tk?si=o3AmNgRbvvikIbi5
- **Back Squat**: https://youtube.com/shorts/hscOjLrW60c?si=w-VfL2KXVSR8tlhX
- **Barbell Row**: https://youtube.com/shorts/UL8ZcK64KxA?si=SDD5wMC5nxQZyKGl
- **Bear Carry**: https://youtube.com/shorts/XVDCJghr56s?si=ag2Bqh3VUPacRdr6
- **Bench Press**: https://youtube.com/shorts/hWbUlkb5Ms4?si=p8AusjhVLAC5ZqJk
- **Bottoms-Up KB Press**: https://youtube.com/shorts/PDVTbKBXAl4?si=AynipcSYTa7P6Z3p
- **Cable Face Pull**: https://youtube.com/shorts/vQCi5Xzhoyw?si=fCAm2YLNsHVcEEMW
- **Calf Raises**: https://youtube.com/shorts/E1mG5L9rpFc?si=LkeJyI_vaFswymaQ
- **Chin-Ups**: https://youtube.com/shorts/gibW62a_3o0?si=hcHIaeENxhRBfQ2L
- **Copenhagen Plank (Half)**: https://youtube.com/shorts/Rwap0_j5i5A?si=t0G7VC_EHuhGD9hE
- **DB Bench Press**: https://youtube.com/shorts/Ne_9EKkUVXY?si=wKZZOtKFsAY4WUiO
- **DB Shoulder Press**: https://youtube.com/shorts/b132W5N8Jrg?si=ntraNt8GsJg9qhx2
- **Deadlift**: https://youtube.com/shorts/vfKwjT5-86k?si=wy5FDB7Fhe0in82l
- **Dumbbell Kickback**: https://youtube.com/shorts/ZGjHc9NnJ-4?si=aXyJRxuhsVVrExqa
- **Explosive Landmine Press**: https://youtube.com/shorts/gKdmAu3yqcc?si=Wp34uZedWc7tV8m7
- **Front Squat**: https://youtube.com/shorts/N4WGYDGu6bI?si=ca0DyggYeEZBOAVa
- **Incline Bench**: https://youtube.com/shorts/L9UKMQw1Nss?si=b0Gf95olarmdMwfc
- **Incline DB Bench**: https://youtube.com/shorts/5orOHJL2qS4?si=IL8OhkIRS1hvZvFH
- **Kneeling Jump**: https://youtube.com/shorts/xaFQGw73peA?si=GiiYoy2aZebpMjtH
- **Landmine Press**: https://youtube.com/shorts/9lSi9Sflr3M?si=WPYiSYjQ3ARgWERJ
- **Lateral Bounds**: https://youtube.com/shorts/Rs1zxDgyUXA?si=cukZToNM-kGFEcEe
- **Lateral Jump**: https://youtube.com/shorts/m1JDpuGzCZw?si=alXGCw-wq5sxSuhK
- **Lateral Raise**: https://youtube.com/shorts/lnVEvYCBGDo?si=c1bGR8q_pCa358Yf
- **Leg Extension**: https://youtube.com/shorts/t8--Y-pjTmg?si=361wZ-G2w94KOacA
- **Leg Press**: https://youtube.com/shorts/nDh_BlnLCGc?si=ePHOzkzXXuoDG6uQ
- **Long-Lever Copenhagen**: https://youtube.com/shorts/NBQIxbMAalk?si=nU796DqBg9LT0fSG
- **Neutral-Grip Pulldown**: https://youtube.com/shorts/QuSqYj7tFbI?si=5lS2n9Tsohh7LPBP
- **Overhead Carry**: https://youtube.com/shorts/_f17ljGZWq0?si=AFi4XzPiPtMbxS3P
- **Overhead Tricep Extension**: https://youtube.com/shorts/ekEo-BSg0_U?si=VKBDNhLGmy1twEla
- **Pull-Ups**: https://youtube.com/shorts/dvG8B2OjfWk?si=yqgXl7NvejneCp1w
- **Push-ups**: https://youtube.com/shorts/c-lBErfxszs?si=k01MuYu6xozOUWy9
- **Scap Push-Up**: https://youtube.com/shorts/emB58J1SyXA?si=7qFwI-rqbIoAKdpm
- **Seated Cable Row**: https://youtube.com/shorts/UyI7Sc7ZVdU?si=oraLYxiDnIkFzVz-
- **Seated DB Press**: https://youtube.com/shorts/-lqkH31Hs10?si=vD5AVHJbeUEJgVx7
- **Single-Arm Lat Pulldown**: https://youtube.com/shorts/8zA8DjHRaq0?si=ndryCAiuk2W18QXv
- **Skull Crushers**: https://youtube.com/shorts/zR9gty7LUxE?si=LomBZEO0pV6BKWC-
- **Speed Bench**: https://youtube.com/shorts/bv1vwhBwjUY?si=qAgsG_WoYjDeX-KV
- **Tricep Pushdown**: https://youtube.com/shorts/xguGXQAvbKk?si=cwE217VcW9OJN1_y
- **Z-Press**: https://youtube.com/shorts/5T4Ax70UqC0?si=loaS9aL3Z1SBWPxh

## Still no video

NONE — every pool exercise has a video after this changeset.

**Correction history.** An earlier draft listed five as missing; the 2026-07-24
correction called that stale and claimed nothing remained. **That correction was
itself incomplete.** Applying the changeset against the pools showed four kept,
cued pool exercises with no entry in `EXERCISE_DEMO_VIDEOS` at all (absent, not
null, and unreachable via the alias map):

- Adductor Machine
- Neutral-Grip Pulldown
- Overhead Carry
- Z-Press

Sam supplied all four above, plus one for the new Abductor Machine. The "NONE
remaining" claim is now true and is enforced by
`src/__tests__/authoredCueLibraryTests.ts` §6, which fails the build if any pool
exercise stops resolving a video.

Zone-1 recovery modalities (Light Walk or Stationary Bike, Incline Treadmill
Walk, Outdoor Walk, Light Skipping) remain out of the map by design and are
excluded from that invariant.

## Unchanged

Every other entry keeps its existing URL. Zone-1 recovery walks stay out of the map by design.