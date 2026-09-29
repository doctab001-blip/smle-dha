-- =============================================================================
-- Demo seed — 4 topics, 4 high-yield notes, 4 questions covering the regional
-- nuances. For local development / UI testing. Review clinically before
-- publishing anything to real users.
-- =============================================================================

with t as (
  insert into public.topics (subject_id, slug, title, sort_order)
  select s.id, v.slug, v.title, v.ord
  from (values
    ('internal-medicine', 'respiratory-infections', 'Respiratory infections',  1),
    ('internal-medicine', 'haematology',            'Haematology',             2),
    ('internal-medicine', 'diabetes',               'Diabetes mellitus',       3),
    ('preventive-ethics', 'genetics-counselling',   'Genetics & premarital screening', 1)
  ) as v(subject_slug, slug, title, ord)
  join public.subjects s on s.slug = v.subject_slug
  returning id, slug
)
insert into public.high_yield_notes (topic_id, slug, title, body_md, source_refs)
select t.id, n.slug, n.title, n.body, n.refs
from t join (values
  ('respiratory-infections', 'mers-cov', 'MERS-CoV',
   E'## MERS-CoV — high yield\n\n- **Reservoir:** dromedary camels; human-to-human spread mainly in healthcare settings.\n- **Suspect when:** fever + respiratory symptoms + camel contact or healthcare exposure in the Arabian Peninsula within 14 days.\n- **Diagnosis:** RT-PCR on a **lower respiratory tract** specimen (sputum, tracheal aspirate, BAL) — preferred over nasopharyngeal swab.\n- **Infection control:** contact + droplet precautions, airborne precautions for aerosol-generating procedures; notify public health.\n- **Complications:** ARDS, AKI.\n- **Treatment:** supportive; no licensed antiviral or vaccine.',
   array['Saudi MOH MERS-CoV guidelines', 'WHO MERS-CoV case definitions']),
  ('haematology', 'acute-chest-syndrome', 'Sickle cell disease: acute chest syndrome',
   E'## Acute chest syndrome (ACS)\n\n- **Definition:** new pulmonary infiltrate on CXR + at least one of: fever, chest pain, tachypnoea, cough, hypoxia.\n- Leading cause of death in adults with SCD.\n- **Management:** oxygen to target saturations, analgesia, IV fluids (avoid overload), incentive spirometry, antibiotics covering atypicals (e.g. cephalosporin + macrolide).\n- **Transfusion:** simple transfusion for hypoxia; exchange transfusion if severe or deteriorating.\n- Common in the Eastern Province of Saudi Arabia.',
   array['BSH guideline: acute chest syndrome']),
  ('diabetes', 'ramadan-fasting-diabetes', 'Diabetes & Ramadan fasting',
   E'## Diabetes and Ramadan\n\n- Risk-stratify before Ramadan (IDF-DAR); pre-Ramadan education is key.\n- **Metformin:** usually continued; twice-daily doses taken at iftar and suhoor.\n- **Sulfonylureas:** avoid **glibenclamide** (highest hypoglycaemia risk); prefer gliclazide / newer agents, main dose at iftar.\n- **DPP-4 inhibitors:** low hypoglycaemia risk, no change usually needed.\n- **Break the fast** if glucose < 70 mg/dL (3.9 mmol/L) or > 300 mg/dL (16.7 mmol/L), or symptomatic.',
   array['IDF-DAR Diabetes and Ramadan Practical Guidelines']),
  ('genetics-counselling', 'autosomal-recessive-consanguinity', 'Consanguinity & autosomal recessive risk',
   E'## Consanguinity\n\n- High rates in KSA increase autosomal recessive disease (haemoglobinopathies, metabolic disorders).\n- **Two carriers:** each pregnancy — 25% affected, 50% carrier, 25% unaffected non-carrier.\n- Saudi **premarital screening** programme tests for sickle cell disease, thalassaemia and infections (HIV, HBV, HCV).\n- Counselling is non-directive; results do not legally prevent marriage.',
   array['Saudi MOH premarital screening programme'])
) as n(topic_slug, slug, title, body, refs) on n.topic_slug = t.slug;


insert into public.questions
  (subject_category, topic_id, note_id, text, lead_in, lab_values, options, correct_answer,
   explanation, option_explanations, exam_targets, difficulty, is_published)
select 'internal-medicine', n.topic_id, n.id, v.*
from public.high_yield_notes n
cross join lateral (values (
  'A 46-year-old man who works on a camel farm near Riyadh presents with 4 days of fever, dry cough and progressive breathlessness. Temperature 39.2 °C, respiratory rate 28/min, SpO2 89% on room air. Chest X-ray shows bilateral patchy infiltrates. Creatinine has risen from 90 to 210 µmol/L.',
  'Which investigation is most appropriate to confirm the likely diagnosis?',
  null::jsonb,
  '[{"key":"A","text":"Sputum Gram stain and culture"},{"key":"B","text":"RT-PCR for MERS-CoV on a lower respiratory tract specimen"},{"key":"C","text":"Serum MERS-CoV IgG serology"},{"key":"D","text":"CT pulmonary angiogram"},{"key":"E","text":"Urinary Legionella antigen"}]'::jsonb,
  'B',
  'Camel exposure, severe pneumonia and AKI in Saudi Arabia strongly suggest **MERS-CoV**. Confirmation is by **RT-PCR**, ideally on a lower respiratory tract sample, which has a higher yield than upper airway swabs. Isolate the patient and notify public health.',
  '{"A":"Useful for bacterial pneumonia but does not confirm MERS-CoV.","C":"Serology is for retrospective/epidemiological diagnosis, not acute confirmation.","D":"No features pointing to PE.","E":"Legionella can cause pneumonia with AKI, but camel exposure makes MERS-CoV the priority."}'::jsonb,
  '{smle,dha}'::public.exam_target[], 'easy'::public.difficulty_level, true
)) as v
where n.slug = 'mers-cov';

insert into public.questions
  (subject_category, topic_id, note_id, text, lead_in, lab_values, options, correct_answer,
   explanation, option_explanations, exam_targets, difficulty, is_published)
select 'internal-medicine', n.topic_id, n.id, v.*
from public.high_yield_notes n
cross join lateral (values (
  'A 19-year-old woman from Al-Ahsa with known HbSS disease presents with 2 days of pain in both thighs, followed today by pleuritic chest pain and fever of 38.6 °C. Respiratory rate 30/min, SpO2 91% on room air. Chest X-ray shows a new right lower zone consolidation.',
  'What is the most likely diagnosis?',
  '[{"test":"Hb","value":"6.8","unit":"g/dL","ref":"12–16"},{"test":"WCC","value":"18.2","unit":"×10⁹/L","ref":"4–11"},{"test":"Reticulocytes","value":"9","unit":"%","ref":"0.5–2.5"}]'::jsonb,
  '[{"key":"A","text":"Acute chest syndrome"},{"key":"B","text":"Pulmonary embolism"},{"key":"C","text":"Uncomplicated vaso-occlusive crisis"},{"key":"D","text":"Aplastic crisis"},{"key":"E","text":"Splenic sequestration crisis"}]'::jsonb,
  'A',
  'A **new pulmonary infiltrate** with fever, chest pain and hypoxia in sickle cell disease defines **acute chest syndrome**. It often follows a limb vaso-occlusive crisis. Treat with oxygen, analgesia, antibiotics and transfusion if hypoxic.',
  '{"B":"PE does not explain fever with new consolidation.","C":"The new infiltrate and hypoxia make this more than a simple VOC.","D":"Aplastic crisis gives a LOW reticulocyte count.","E":"Sequestration presents with a rapidly enlarging spleen and falling Hb, mostly in young children."}'::jsonb,
  '{smle,dha}'::public.exam_target[], 'easy'::public.difficulty_level, true
)) as v
where n.slug = 'acute-chest-syndrome';

insert into public.questions
  (subject_category, topic_id, note_id, text, lead_in, lab_values, options, correct_answer,
   explanation, option_explanations, exam_targets, difficulty, is_published)
select 'internal-medicine', n.topic_id, n.id, v.*
from public.high_yield_notes n
cross join lateral (values (
  'A 52-year-old man with type 2 diabetes wishes to fast during Ramadan. He takes metformin 1 g twice daily and glibenclamide 5 mg twice daily. HbA1c is 7.4%. He has no history of severe hypoglycaemia and normal renal function.',
  'What is the most appropriate adjustment to his medication?',
  null::jsonb,
  '[{"key":"A","text":"Continue both drugs at the same times and doses"},{"key":"B","text":"Stop metformin for the month of Ramadan"},{"key":"C","text":"Replace glibenclamide with gliclazide; take metformin at iftar and suhoor"},{"key":"D","text":"Take both glibenclamide doses together at suhoor"},{"key":"E","text":"Stop both oral agents and start basal insulin"}]'::jsonb,
  'C',
  'Glibenclamide carries the highest hypoglycaemia risk among sulfonylureas and should be avoided during fasting. Switching to **gliclazide** (main dose at iftar) and splitting **metformin** between iftar and suhoor is the recommended approach (IDF-DAR).',
  '{"A":"Glibenclamide during fasting carries a high hypoglycaemia risk.","B":"Metformin has low hypoglycaemia risk and is continued.","D":"A large pre-dawn sulfonylurea dose causes daytime hypoglycaemia.","E":"Unnecessary escalation for a well-controlled patient."}'::jsonb,
  '{smle,dha,doh,mohap}'::public.exam_target[], 'medium'::public.difficulty_level, true
)) as v
where n.slug = 'ramadan-fasting-diabetes';

insert into public.questions
  (subject_category, topic_id, note_id, text, lead_in, lab_values, options, correct_answer,
   explanation, option_explanations, exam_targets, difficulty, is_published)
select 'preventive-ethics', n.topic_id, n.id, v.*
from public.high_yield_notes n
cross join lateral (values (
  'A couple who are first cousins attend the clinic after premarital screening. Both are found to have beta-thalassaemia trait. They ask about the risk to their future children.',
  'What is the probability that each pregnancy will result in a child with beta-thalassaemia major?',
  null::jsonb,
  '[{"key":"A","text":"0%"},{"key":"B","text":"12.5%"},{"key":"C","text":"25%"},{"key":"D","text":"50%"},{"key":"E","text":"100%"}]'::jsonb,
  'C',
  'Beta-thalassaemia is **autosomal recessive**. With two carrier parents, each pregnancy has a **25%** chance of an affected child, 50% chance of a carrier and 25% chance of an unaffected non-carrier. Consanguinity raises the chance that both partners carry the same recessive allele; it does not change the per-pregnancy risk once both are known carriers.',
  '{"D":"50% is the chance of a carrier child.","B":"12.5% has no basis in single-gene AR inheritance."}'::jsonb,
  '{smle,dha}'::public.exam_target[], 'easy'::public.difficulty_level, true
)) as v
where n.slug = 'autosomal-recessive-consanguinity';

-- Tag the questions
insert into public.question_tags (question_id, tag_id)
select q.id, tg.id
from public.questions q
join public.high_yield_notes n on n.id = q.note_id
join (values
  ('mers-cov', 'mers-cov'),
  ('acute-chest-syndrome', 'sickle-cell-disease'),
  ('ramadan-fasting-diabetes', 'ramadan-fasting'),
  ('autosomal-recessive-consanguinity', 'consanguinity'),
  ('autosomal-recessive-consanguinity', 'thalassaemia')
) as m(note_slug, tag_slug) on m.note_slug = n.slug
join public.tags tg on tg.slug = m.tag_slug;
