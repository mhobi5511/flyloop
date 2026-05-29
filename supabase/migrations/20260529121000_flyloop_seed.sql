insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rafa.demo@flyloop.local',
    crypt('flyloop-demo', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Rafa Demo Coach"}',
    false,
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tota.demo@flyloop.local',
    crypt('flyloop-demo', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Tota Demo Coach"}',
    false,
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'marc.demo@flyloop.local',
    crypt('flyloop-demo', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Marc Demo Coach"}',
    false,
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'lina.demo@flyloop.local',
    crypt('flyloop-demo', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Lina Demo Athlete"}',
    false,
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin.demo@flyloop.local',
    crypt('flyloop-demo', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Flyloop Demo Admin"}',
    false,
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

insert into public.profiles (
  id,
  role,
  full_name,
  country,
  phone,
  whatsapp_number,
  instagram_handle,
  disciplines
) values
  (
    '00000000-0000-0000-0000-000000000001',
    'coach',
    'Rafa Demo Coach',
    'Spain',
    '+34600111001',
    '+34600111001',
    'rafa.demo.fly',
    array['Dynamic', 'Angles', 'VFS']
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'coach',
    'Tota Demo Coach',
    'Poland',
    '+48600111002',
    '+48600111002',
    'tota.demo.fly',
    array['Dynamic', 'Freefly']
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'coach',
    'Marc Demo Coach',
    'Germany',
    '+49170111003',
    '+49170111003',
    'marc.demo.fly',
    array['Belly', 'Backfly', 'Transitions']
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    'athlete',
    'Lina Demo Athlete',
    'Germany',
    '+491701112233',
    '+491701112233',
    'lina.demo.fly',
    array['Dynamic', 'Belly']
  ),
  (
    '00000000-0000-0000-0000-000000000099',
    'admin',
    'Flyloop Demo Admin',
    'Germany',
    null,
    null,
    'flyloop.admin',
    '{}'
  )
on conflict (id) do update set
  role = excluded.role,
  full_name = excluded.full_name,
  country = excluded.country,
  phone = excluded.phone,
  whatsapp_number = excluded.whatsapp_number,
  instagram_handle = excluded.instagram_handle,
  disciplines = excluded.disciplines;

insert into public.tunnel_profiles (
  id,
  name,
  country,
  city,
  address,
  website,
  description,
  wind_quality_notes,
  size
) values
  (
    '10000000-0000-0000-0000-000000000001',
    'Jochen Schweizer Arena',
    'Germany',
    'Munich',
    'Ludwig-Boltzmann-Strasse 1, 85609 Taufkirchen',
    'https://www.jochen-schweizer-arena.de',
    'Indoor skydiving tunnel and action sports venue near Munich.',
    'Smooth beginner-friendly airflow with strong event operations.',
    '14 ft'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'FlyStation Munich',
    'Germany',
    'Munich',
    'Munich area',
    'https://www.flystation.de',
    'Sport-focused tunnel option for Munich flyers.',
    'Consistent flow for camps and recurring coaching sessions.',
    '14 ft'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Flyspot Warsaw',
    'Poland',
    'Warsaw',
    'Wspolna Droga 1, Mory',
    'https://flyspot.com',
    'Large Polish tunnel venue with strong community events.',
    'Known for reliable sport flying conditions and active events.',
    '14 ft'
  )
on conflict (id) do update set
  name = excluded.name,
  country = excluded.country,
  city = excluded.city,
  address = excluded.address,
  website = excluded.website,
  description = excluded.description,
  wind_quality_notes = excluded.wind_quality_notes,
  size = excluded.size;

insert into public.coach_profiles (
  id,
  user_id,
  bio,
  profile_image_url,
  disciplines,
  languages,
  achievements,
  instagram_handle,
  coaching_tunnels
) values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Rafa coaches dynamic, angles and VFS progressions with a calm, structured camp format.',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
    array['Dynamic', 'Angles', 'VFS'],
    array['English', 'Spanish'],
    array['World-level team training', 'International camp organizer'],
    'rafa.demo.fly',
    array['10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid]
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Tota builds energetic camps for flyers working on dynamic confidence and group awareness.',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    array['Dynamic', 'Freefly'],
    array['English', 'Polish'],
    array['European camp organizer', 'Dynamic team coach'],
    'tota.demo.fly',
    array['10000000-0000-0000-0000-000000000003'::uuid]
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'Marc helps athletes build reliable foundations in belly, backfly and transitions.',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    array['Belly', 'Backfly', 'Transitions'],
    array['English', 'German'],
    array['Senior tunnel coach', 'Progression curriculum builder'],
    'marc.demo.fly',
    array['10000000-0000-0000-0000-000000000001'::uuid]
  )
on conflict (id) do update set
  user_id = excluded.user_id,
  bio = excluded.bio,
  profile_image_url = excluded.profile_image_url,
  disciplines = excluded.disciplines,
  languages = excluded.languages,
  achievements = excluded.achievements,
  instagram_handle = excluded.instagram_handle,
  coaching_tunnels = excluded.coaching_tunnels;

insert into public.opportunities (
  id,
  type,
  title,
  coach_id,
  tunnel_id,
  start_date,
  end_date,
  registration_deadline,
  price,
  currency,
  total_capacity,
  available_spots,
  min_minutes_or_hours,
  description,
  languages,
  disciplines,
  skill_level,
  status,
  contact_method,
  created_by
) values
  (
    '30000000-0000-0000-0000-000000000001',
    'camp',
    'Camp with Rafa at Jochen Schweizer Arena',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    current_date + 24,
    current_date + 25,
    current_date + 14,
    520,
    'EUR',
    8,
    3,
    '60 min per athlete',
    'Two days of dynamic and angle progression with Rafa in Munich.',
    array['English', 'Spanish'],
    array['Dynamic', 'Angles'],
    'Intermediate',
    'published',
    'whatsapp',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'camp',
    'Camp with Tota in Warsaw',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    current_date + 32,
    current_date + 33,
    current_date + 21,
    490,
    'EUR',
    10,
    5,
    '55 min per athlete',
    'A high-energy dynamic camp at Flyspot Warsaw with Tota.',
    array['English', 'Polish'],
    array['Dynamic', 'Freefly'],
    'Intermediate',
    'published',
    'instagram',
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    'huck_jam',
    'Huck Jam Munich',
    null,
    '10000000-0000-0000-0000-000000000002',
    current_date + 16,
    current_date + 16,
    current_date + 10,
    95,
    'EUR',
    20,
    9,
    '10 min blocks',
    'Open huck jam in Munich for mixed groups and fast rotations.',
    array['English', 'German'],
    array['Belly', 'Backfly', 'Dynamic'],
    'All levels',
    'published',
    'whatsapp',
    '00000000-0000-0000-0000-000000000099'
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    'camp',
    'Rafa Last-Minute Dynamic Camp',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    current_date + 4,
    current_date + 5,
    current_date + 2,
    430,
    'EUR',
    8,
    2,
    '45 min per athlete',
    'Starts soon, still published and still has spots, so Flyloop promotes it automatically as last-minute.',
    array['English', 'Spanish'],
    array['Dynamic', 'Angles'],
    'Intermediate',
    'published',
    'whatsapp',
    '00000000-0000-0000-0000-000000000001'
  )
on conflict (id) do update set
  type = excluded.type,
  title = excluded.title,
  coach_id = excluded.coach_id,
  tunnel_id = excluded.tunnel_id,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  registration_deadline = excluded.registration_deadline,
  price = excluded.price,
  currency = excluded.currency,
  total_capacity = excluded.total_capacity,
  available_spots = excluded.available_spots,
  min_minutes_or_hours = excluded.min_minutes_or_hours,
  description = excluded.description,
  languages = excluded.languages,
  disciplines = excluded.disciplines,
  skill_level = excluded.skill_level,
  status = excluded.status,
  contact_method = excluded.contact_method,
  created_by = excluded.created_by;

insert into public.follows (id, follower_id, target_type, target_id) values
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'coach',
    '20000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000010',
    'tunnel',
    '10000000-0000-0000-0000-000000000001'
  )
on conflict (id) do nothing;

insert into public.opportunity_interests (
  id,
  opportunity_id,
  athlete_id,
  status,
  message
) values (
  '50000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000010',
  'pending',
  'I can join both days and prefer WhatsApp.'
)
on conflict (opportunity_id, athlete_id) do update set
  status = excluded.status,
  message = excluded.message;

insert into public.notifications (
  id,
  user_id,
  title,
  body,
  type,
  opportunity_id,
  read
) values (
  '60000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'New athlete interest',
  'Lina Demo Athlete is interested in Rafa Last-Minute Dynamic Camp.',
  'opportunity_interest',
  '30000000-0000-0000-0000-000000000004',
  false
)
on conflict (id) do update set
  title = excluded.title,
  body = excluded.body,
  type = excluded.type,
  opportunity_id = excluded.opportunity_id,
  read = excluded.read;
