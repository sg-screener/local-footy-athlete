-- Seed exercises table with comprehensive AFL training exercises

INSERT INTO exercises (name, description, muscle_groups, exercise_type, equipment_required, difficulty_level) VALUES

-- Barbell Compound Lifts
('Back Squat', 'Barbell squat with bar on back shoulders, fundamental lower body compound movement', ARRAY['quadriceps', 'glutes', 'hamstrings', 'lower back'], 'compound', ARRAY['barbell', 'squat rack'], 4),
('Front Squat', 'Barbell squat with bar on front shoulders, emphasizes quads and core', ARRAY['quadriceps', 'glutes', 'core', 'upper back'], 'compound', ARRAY['barbell', 'squat rack'], 4),
('Deadlift', 'Barbell lift from ground to hip height, total body compound movement', ARRAY['hamstrings', 'glutes', 'lower back', 'upper back', 'core'], 'compound', ARRAY['barbell', 'plates'], 5),
('Romanian Deadlift', 'Hinge movement emphasizing hamstrings and posterior chain', ARRAY['hamstrings', 'glutes', 'lower back', 'upper back'], 'compound', ARRAY['barbell', 'dumbbell'], 3),
('Bench Press', 'Barbell pressing movement for chest, shoulders and triceps', ARRAY['chest', 'triceps', 'shoulders'], 'compound', ARRAY['barbell', 'bench', 'squat rack'], 4),
('Incline Bench Press', 'Angled bench press emphasizing upper chest and front shoulders', ARRAY['chest', 'shoulders', 'triceps'], 'compound', ARRAY['barbell', 'incline bench'], 3),
('Decline Bench Press', 'Angled downward bench press for lower chest emphasis', ARRAY['chest', 'triceps', 'shoulders'], 'compound', ARRAY['barbell', 'decline bench'], 3),
('Barbell Row', 'Bent-over row for upper back and lats', ARRAY['upper back', 'lats', 'biceps', 'lower back'], 'compound', ARRAY['barbell', 'plates'], 4),
('Pendulum Row', 'Machine row variation reducing lower back strain', ARRAY['upper back', 'lats', 'biceps'], 'compound', ARRAY['pendulum machine'], 2),
('Overhead Press', 'Standing or seated barbell pressing movement for shoulders and triceps', ARRAY['shoulders', 'triceps', 'upper chest', 'core'], 'compound', ARRAY['barbell', 'squat rack'], 4),
('Push Press', 'Overhead press with leg drive for power and strength', ARRAY['shoulders', 'triceps', 'legs', 'core'], 'compound', ARRAY['barbell'], 4),
('Power Clean', 'Olympic lift for explosive power and total body coordination', ARRAY['quadriceps', 'hamstrings', 'glutes', 'upper back', 'shoulders'], 'compound', ARRAY['barbell', 'bumper plates'], 5),
('Hang Clean', 'Olympic lift variant starting from hip height, reduced technique difficulty', ARRAY['quadriceps', 'hamstrings', 'glutes', 'upper back', 'shoulders'], 'compound', ARRAY['barbell', 'bumper plates'], 4),

-- Hip and Glute Focus
('Hip Thrust', 'Barbell hip extension for glute and posterior chain strength', ARRAY['glutes', 'hamstrings', 'lower back'], 'compound', ARRAY['barbell', 'bench'], 3),
('Bulgarian Split Squat', 'Single leg squat variation with rear foot elevated', ARRAY['quadriceps', 'glutes', 'hamstrings'], 'compound', ARRAY['dumbbell', 'bench'], 3),
('Lunges', 'Single leg movement for quadriceps, glutes and balance', ARRAY['quadriceps', 'glutes', 'hamstrings', 'core'], 'compound', ARRAY['dumbbell', 'barbell'], 2),
('Walking Lunges', 'Dynamic lunge variation for functional leg strength', ARRAY['quadriceps', 'glutes', 'hamstrings', 'core'], 'compound', ARRAY['dumbbell', 'barbell'], 2),
('Goblet Squat', 'Dumbbell or kettlebell squat held at chest', ARRAY['quadriceps', 'glutes', 'core'], 'compound', ARRAY['dumbbell', 'kettlebell'], 2),
('Kettlebell Swings', 'Dynamic hip hinge movement for power and conditioning', ARRAY['glutes', 'hamstrings', 'lower back', 'core'], 'compound', ARRAY['kettlebell'], 2),

-- Plyometric and Power
('Box Jumps', 'Jumping onto elevated box for explosive lower body power', ARRAY['quadriceps', 'glutes', 'calves', 'core'], 'plyometric', ARRAY['plyo box'], 4),
('Broad Jumps', 'Horizontal jumping for distance and power', ARRAY['quadriceps', 'glutes', 'hamstrings', 'calves'], 'plyometric', ARRAY[], 4),
('Vertical Jumps', 'Maximal height jumping for explosive power', ARRAY['quadriceps', 'glutes', 'calves', 'core'], 'plyometric', ARRAY[], 4),
('Single Leg Hops', 'Hopping on one leg for balance and unilateral power', ARRAY['quadriceps', 'glutes', 'calves', 'core'], 'plyometric', ARRAY[], 3),
('Bounding', 'Running with exaggerated stride for speed and power development', ARRAY['quadriceps', 'glutes', 'hamstrings', 'calves'], 'plyometric', ARRAY[], 3),
('Lateral Bounds', 'Side-to-side bounding for lateral power and agility', ARRAY['adductors', 'abductors', 'glutes', 'quadriceps'], 'plyometric', ARRAY[], 3),

-- Upper Body Pulling
('Pull-ups', 'Bodyweight upper body pulling exercise for lats and biceps', ARRAY['lats', 'biceps', 'upper back', 'core'], 'compound', ARRAY['pull-up bar'], 4),
('Chin-ups', 'Underhand grip pull-up variation emphasizing biceps', ARRAY['biceps', 'lats', 'upper back', 'core'], 'compound', ARRAY['pull-up bar'], 4),
('Assisted Pull-ups', 'Machine or band assisted pull-up for progression', ARRAY['lats', 'biceps', 'upper back', 'core'], 'compound', ARRAY['pull-up machine', 'resistance band'], 2),
('Lat Pulldown', 'Machine movement for lat and upper back development', ARRAY['lats', 'biceps', 'upper back'], 'compound', ARRAY['lat pulldown machine'], 2),
('Seated Cable Row', 'Machine row for upper back and lat strength', ARRAY['upper back', 'lats', 'biceps'], 'compound', ARRAY['cable machine'], 2),
('Face Pulls', 'Rope cable exercise for rear shoulders and upper back', ARRAY['rear shoulders', 'upper back', 'biceps'], 'isolation', ARRAY['cable machine', 'rope'], 1),
('Band Pull-Aparts', 'Resistance band exercise for shoulder mobility and rear delts', ARRAY['rear shoulders', 'upper back', 'scapula'], 'isolation', ARRAY['resistance band'], 1),

-- Upper Body Pressing
('Push-ups', 'Bodyweight chest, shoulder and tricep pressing movement', ARRAY['chest', 'triceps', 'shoulders', 'core'], 'compound', ARRAY[], 2),
('Close Grip Push-ups', 'Push-up variation with hands closer for tricep emphasis', ARRAY['triceps', 'chest', 'shoulders'], 'compound', ARRAY[], 3),
('Dips', 'Bodyweight pressing movement for chest and triceps', ARRAY['chest', 'triceps', 'shoulders', 'core'], 'compound', ARRAY['dip bars', 'bench'], 3),
('Assisted Dips', 'Machine or band assisted dip for progression', ARRAY['chest', 'triceps', 'shoulders', 'core'], 'compound', ARRAY['dip machine', 'resistance band'], 2),
('Dumbbell Bench Press', 'Dumbbell variation of bench press', ARRAY['chest', 'triceps', 'shoulders', 'stabilizer muscles'], 'compound', ARRAY['dumbbell', 'bench'], 3),
('Dumbbell Incline Press', 'Dumbbell incline pressing for upper chest', ARRAY['chest', 'shoulders', 'triceps'], 'compound', ARRAY['dumbbell', 'incline bench'], 3),

-- Tricep Isolation
('Tricep Dips', 'Bench dip variation using body weight', ARRAY['triceps', 'chest', 'shoulders'], 'isolation', ARRAY['bench'], 2),
('Rope Tricep Pushdown', 'Cable exercise for tricep isolation', ARRAY['triceps'], 'isolation', ARRAY['cable machine', 'rope'], 1),
('Skull Crushers', 'Barbell or dumbbell exercise for tricep strength', ARRAY['triceps'], 'isolation', ARRAY['barbell', 'dumbbell', 'bench'], 2),
('Tricep Rope Extensions', 'Overhead cable extension for long head of tricep', ARRAY['triceps'], 'isolation', ARRAY['cable machine', 'rope'], 1),

-- Shoulder Isolation
('Lateral Raises', 'Dumbbell side raise for lateral shoulder development', ARRAY['lateral shoulders', 'core'], 'isolation', ARRAY['dumbbell'], 1),
('Front Raises', 'Dumbbell front raise for anterior shoulder', ARRAY['anterior shoulders', 'core'], 'isolation', ARRAY['dumbbell'], 1),
('Reverse Pec Deck', 'Machine exercise for rear shoulder development', ARRAY['rear shoulders', 'upper back'], 'isolation', ARRAY['pec deck machine'], 1),
('Shoulder Shrugs', 'Dumbbell or barbell shrug for trap strength', ARRAY['traps', 'upper back'], 'isolation', ARRAY['dumbbell', 'barbell'], 1),

-- Core and Stability
('Plank', 'Isometric core exercise for stability and endurance', ARRAY['core', 'shoulders', 'lower back'], 'isolation', ARRAY[], 1),
('Side Plank', 'Single-side plank for obliques and lateral core', ARRAY['obliques', 'lateral core', 'shoulders'], 'isolation', ARRAY[], 1),
('Pallof Press', 'Cable anti-rotation exercise for core stability', ARRAY['core', 'obliques', 'shoulders'], 'isolation', ARRAY['cable machine'], 2),
('Cable Woodchops', 'Rotational core exercise for power and stability', ARRAY['core', 'obliques', 'shoulders'], 'isolation', ARRAY['cable machine'], 2),
('Dead Bug', 'Lying core exercise for stability and coordination', ARRAY['core', 'lower back'], 'isolation', ARRAY[], 1),
('Bird Dog', 'Quadruped core exercise for stability', ARRAY['core', 'lower back', 'glutes'], 'isolation', ARRAY[], 1),
('Hanging Leg Raises', 'Hanging core exercise for lower ab strength', ARRAY['core', 'hip flexors'], 'isolation', ARRAY['pull-up bar'], 3),
('Ab Wheel Rollouts', 'Kneeling or standing core exercise for strength', ARRAY['core', 'shoulders', 'lower back'], 'isolation', ARRAY['ab wheel'], 3),
('Russian Twists', 'Rotational core exercise for obliques', ARRAY['obliques', 'core'], 'isolation', ARRAY['medicine ball', 'weight plate'], 1),

-- Calf and Ankle
('Calf Raises', 'Standing calf raise for ankle plantar flexors', ARRAY['calves'], 'isolation', ARRAY['barbell', 'dumbbell'], 1),
('Seated Calf Raises', 'Machine or seated calf raise variation', ARRAY['calves'], 'isolation', ARRAY['calf machine'], 1),

-- Lower Body Assistance
('Leg Press', 'Machine squat variation for leg strength', ARRAY['quadriceps', 'glutes', 'hamstrings'], 'compound', ARRAY['leg press machine'], 2),
('Leg Curl', 'Machine exercise for hamstring isolation', ARRAY['hamstrings'], 'isolation', ARRAY['leg curl machine'], 1),
('Leg Extension', 'Machine exercise for quadriceps isolation', ARRAY['quadriceps'], 'isolation', ARRAY['leg extension machine'], 1),

-- Battle Ropes and Sled Work
('Battle Ropes', 'Wave-based exercise for power and conditioning', ARRAY['core', 'shoulders', 'cardio system'], 'cardio', ARRAY['battle ropes'], 2),
('Sled Push', 'Heavy sled push for lower body power and conditioning', ARRAY['quadriceps', 'glutes', 'core'], 'compound', ARRAY['weighted sled'], 2),
('Prowler Push', 'Prowler sled push for quad and glute development', ARRAY['quadriceps', 'glutes', 'core'], 'compound', ARRAY['prowler sled'], 2),
('Sled Drag', 'Sled dragging for posterior chain and conditioning', ARRAY['glutes', 'hamstrings', 'lower back'], 'compound', ARRAY['weighted sled', 'rope'], 2),

-- Dumbbell Variations
('Dumbbell Rows', 'Single arm dumbbell row for back and core', ARRAY['upper back', 'lats', 'biceps', 'core'], 'compound', ARRAY['dumbbell'], 2),
('Dumbbell Flyes', 'Dumbbell chest fly for pectorals and stability', ARRAY['chest', 'shoulders', 'stabilizer muscles'], 'isolation', ARRAY['dumbbell', 'bench'], 2),
('Dumbbell Pullovers', 'Chest and back exercise with dumbbell', ARRAY['chest', 'lats', 'core'], 'compound', ARRAY['dumbbell', 'bench'], 2),
('Dumbbell Overhead Press', 'Standing dumbbell shoulder press', ARRAY['shoulders', 'triceps', 'core'], 'compound', ARRAY['dumbbell'], 2),
('Dumbbell Curls', 'Dumbbell bicep curl for arm strength', ARRAY['biceps', 'forearms'], 'isolation', ARRAY['dumbbell'], 1),
('Hammer Curls', 'Neutral grip dumbbell curl emphasizing brachialis', ARRAY['biceps', 'brachialis', 'forearms'], 'isolation', ARRAY['dumbbell'], 1),

-- Olympic and Power Variations
('Power Snatch', 'Olympic weightlifting movement for explosive power', ARRAY['quadriceps', 'hamstrings', 'glutes', 'shoulders', 'core'], 'compound', ARRAY['barbell', 'bumper plates'], 5),
('Hang Power Clean', 'Clean from hip height for power development', ARRAY['quadriceps', 'hamstrings', 'glutes', 'upper back', 'shoulders'], 'compound', ARRAY['barbell', 'bumper plates'], 4),

-- Mobility and Flexibility
('Thoracic Foam Rolling', 'Self-myofascial release for thoracic mobility', ARRAY['thoracic spine', 'upper back'], 'mobility', ARRAY['foam roller'], 1),
('Hip Mobility Work', 'Dynamic and static stretching for hip range of motion', ARRAY['hips', 'core'], 'mobility', ARRAY[], 1),
('Pigeon Pose', 'Hip opener stretch for glutes and hip flexors', ARRAY['glutes', 'hip flexors', 'hips'], 'mobility', ARRAY[], 1),
('Cat-Cow Stretch', 'Spinal mobilization exercise for thoracic and lumbar spine', ARRAY['spine', 'core'], 'mobility', ARRAY[], 1),

-- Conditioning
('Jump Rope', 'Rope skipping for cardiovascular conditioning and coordination', ARRAY['calves', 'core', 'cardiovascular system'], 'cardio', ARRAY['jump rope'], 1),
('Rowing Machine', 'Machine-based full body cardio and conditioning', ARRAY['lats', 'upper back', 'legs', 'core', 'cardiovascular system'], 'cardio', ARRAY['rowing machine'], 2),
('Assault Bike', 'Fan-based bike for high intensity conditioning', ARRAY['legs', 'cardiovascular system', 'core'], 'cardio', ARRAY['assault bike'], 2),
('Sprints', 'High-speed running for speed and power development', ARRAY['quadriceps', 'hamstrings', 'glutes', 'calves', 'cardiovascular system'], 'cardio', ARRAY[], 2),
('Hill Sprints', 'Incline sprints for power and conditioning', ARRAY['quadriceps', 'glutes', 'hamstrings', 'calves', 'cardiovascular system'], 'cardio', ARRAY[], 3),
('Shuttle Runs', 'Directional running for agility and conditioning', ARRAY['legs', 'cardiovascular system', 'core'], 'cardio', ARRAY[], 2);
