// GulfMed QBank — question-generation blueprint.
// 200 questions per subject. `count` = questions for the topic; `concepts` = keywords
// counted in the reference PDFs to decide which concepts get the most questions.
// Edit freely: counts must add up to the subject target (checked at runtime).

export const TARGET_PER_SUBJECT = 200;

export const BLUEPRINT = [
  {
    subject: 'Internal Medicine',
    topics: [
      { chapter: 'Cardiology', count: 30, concepts: ['acute coronary syndrome', 'STEMI', 'heart failure', 'atrial fibrillation', 'hypertension', 'infective endocarditis', 'aortic stenosis', 'mitral stenosis', 'rheumatic fever', 'pericarditis', 'cardiac tamponade', 'bradycardia', 'ventricular tachycardia', 'dyslipidaemia', 'syncope'] },
      { chapter: 'Endocrinology', count: 28, concepts: ['type 2 diabetes', 'type 1 diabetes', 'diabetic ketoacidosis', 'hyperosmolar', 'hypoglycaemia', 'Ramadan', 'hypothyroidism', 'thyrotoxicosis', 'thyroid nodule', 'Cushing', 'Addison', 'adrenal insufficiency', 'hyperparathyroidism', 'hypercalcaemia', 'vitamin D deficiency', 'prolactinoma', 'hyponatraemia', 'SIADH', 'obesity'] },
      { chapter: 'Pulmonology', count: 22, concepts: ['asthma', 'COPD', 'pneumonia', 'tuberculosis', 'pulmonary embolism', 'pleural effusion', 'pneumothorax', 'interstitial lung disease', 'sarcoidosis', 'obstructive sleep apnoea', 'lung cancer', 'bronchiectasis', 'MERS'] },
      { chapter: 'Gastroenterology & Hepatology', count: 22, concepts: ['peptic ulcer', 'Helicobacter', 'upper GI bleeding', 'variceal', 'cirrhosis', 'hepatitis B', 'hepatitis C', 'fatty liver', 'coeliac', 'inflammatory bowel disease', "Crohn", 'ulcerative colitis', 'acute pancreatitis', 'GERD', 'irritable bowel'] },
      { chapter: 'Nephrology', count: 18, concepts: ['acute kidney injury', 'chronic kidney disease', 'nephrotic syndrome', 'nephritic', 'IgA nephropathy', 'hyperkalaemia', 'metabolic acidosis', 'renal stones', 'polycystic kidney', 'urinary tract infection', 'dialysis'] },
      { chapter: 'Haematology', count: 20, concepts: ['iron deficiency', 'sickle cell', 'thalassaemia', 'G6PD', 'vitamin B12', 'haemolytic anaemia', 'ITP', 'TTP', 'DIC', 'haemophilia', 'von Willebrand', 'leukaemia', 'lymphoma', 'multiple myeloma', 'anticoagulation', 'heparin-induced'] },
      { chapter: 'Infectious Disease', count: 26, concepts: ['brucellosis', 'MERS', 'COVID', 'HIV', 'malaria', 'dengue', 'typhoid', 'meningitis', 'sepsis', 'cellulitis', 'leishmaniasis', 'schistosomiasis', 'hepatitis', 'tuberculosis', 'Hajj', 'meningococcal', 'antibiotic stewardship'] },
      { chapter: 'Rheumatology', count: 14, concepts: ['rheumatoid arthritis', 'systemic lupus', 'gout', 'pseudogout', 'septic arthritis', 'ankylosing spondylitis', 'Behçet', 'familial Mediterranean fever', 'vasculitis', 'giant cell arteritis', 'osteoporosis', 'polymyalgia'] },
      { chapter: 'Neurology', count: 20, concepts: ['stroke', 'transient ischaemic attack', 'subarachnoid haemorrhage', 'epilepsy', 'status epilepticus', 'migraine', 'multiple sclerosis', "Parkinson", 'myasthenia gravis', 'Guillain-Barré', 'peripheral neuropathy', 'dementia', 'idiopathic intracranial hypertension'] },
    ],
  },
  {
    subject: 'Pediatrics',
    topics: [
      { chapter: 'Neonatology', count: 25, concepts: ['neonatal jaundice', 'respiratory distress syndrome', 'transient tachypnoea', 'neonatal sepsis', 'hypoglycaemia', 'necrotising enterocolitis', 'neonatal resuscitation', 'hypoxic ischaemic encephalopathy', 'congenital hypothyroidism', 'newborn screening'] },
      { chapter: 'Growth, Development & Nutrition', count: 20, concepts: ['developmental milestones', 'failure to thrive', 'short stature', 'rickets', 'breastfeeding', 'iron deficiency', 'obesity', 'puberty'] },
      { chapter: 'Immunisation', count: 15, concepts: ['vaccination schedule', 'contraindications', 'BCG', 'MMR', 'rotavirus', 'catch-up', 'Hajj vaccination'] },
      { chapter: 'Paediatric Infections', count: 25, concepts: ['bronchiolitis', 'croup', 'otitis media', 'pneumonia', 'meningitis', 'UTI', 'Kawasaki', 'measles', 'varicella', 'scarlet fever', 'gastroenteritis', 'dehydration'] },
      { chapter: 'Genetics & Metabolic', count: 20, concepts: ['consanguinity', 'autosomal recessive', 'Down syndrome', 'inborn errors of metabolism', 'phenylketonuria', 'urea cycle', 'glycogen storage', 'cystic fibrosis', 'premarital screening'] },
      { chapter: 'Paediatric Haematology & Oncology', count: 15, concepts: ['sickle cell', 'beta thalassaemia', 'G6PD', 'ITP', 'acute lymphoblastic leukaemia', 'Wilms', 'neuroblastoma', 'haemophilia'] },
      { chapter: 'Paediatric Emergencies', count: 25, concepts: ['anaphylaxis', 'status epilepticus', 'febrile seizure', 'DKA', 'poisoning', 'foreign body', 'drowning', 'non-accidental injury', 'shock', 'intussusception', 'scorpion sting'] },
      { chapter: 'Paediatric Respiratory & Allergy', count: 20, concepts: ['asthma', 'wheeze', 'allergic rhinitis', 'food allergy', 'atopic dermatitis', 'cystic fibrosis'] },
      { chapter: 'Paediatric GI & Surgery', count: 15, concepts: ['pyloric stenosis', 'intussusception', 'Hirschsprung', 'appendicitis', 'coeliac', 'GERD', 'constipation'] },
      { chapter: 'Paediatric Cardiology & Nephrology', count: 20, concepts: ['VSD', 'ASD', 'PDA', 'tetralogy of Fallot', 'coarctation', 'rheumatic fever', 'nephrotic syndrome', 'post-streptococcal glomerulonephritis', 'haemolytic uraemic syndrome', 'vesicoureteric reflux'] },
    ],
  },
  {
    subject: 'Obstetrics & Gynecology',
    topics: [
      { chapter: 'Antenatal Care', count: 25, concepts: ['booking bloods', 'anaemia in pregnancy', 'Rh isoimmunisation', 'screening', 'folic acid', 'nausea and vomiting', 'hyperemesis', 'fetal growth restriction', 'Ramadan fasting in pregnancy'] },
      { chapter: 'Hypertensive Disorders of Pregnancy', count: 20, concepts: ['pre-eclampsia', 'eclampsia', 'HELLP', 'gestational hypertension', 'magnesium sulfate', 'aspirin prophylaxis'] },
      { chapter: 'Medical Disorders in Pregnancy', count: 15, concepts: ['gestational diabetes', 'thyroid in pregnancy', 'epilepsy in pregnancy', 'VTE in pregnancy', 'sickle cell in pregnancy', 'cardiac disease in pregnancy'] },
      { chapter: 'Obstetric Haemorrhage', count: 20, concepts: ['placenta praevia', 'placental abruption', 'postpartum haemorrhage', 'uterine atony', 'placenta accreta', 'vasa praevia'] },
      { chapter: 'Labour & Delivery', count: 20, concepts: ['preterm labour', 'PPROM', 'induction of labour', 'CTG', 'shoulder dystocia', 'breech', 'cord prolapse', 'caesarean section', 'VBAC'] },
      { chapter: 'Early Pregnancy', count: 20, concepts: ['ectopic pregnancy', 'miscarriage', 'molar pregnancy', 'hCG', 'recurrent miscarriage'] },
      { chapter: 'Gynaecological Oncology', count: 20, concepts: ['cervical screening', 'HPV', 'cervical cancer', 'endometrial cancer', 'ovarian cancer', 'CA-125', 'postmenopausal bleeding'] },
      { chapter: 'Menstrual Disorders & Endocrinology', count: 20, concepts: ['PCOS', 'amenorrhoea', 'heavy menstrual bleeding', 'fibroids', 'endometriosis', 'premenstrual syndrome'] },
      { chapter: 'Fertility & Contraception', count: 20, concepts: ['infertility', 'IVF', 'OHSS', 'combined pill', 'IUD', 'emergency contraception', 'contraception with medical conditions'] },
      { chapter: 'Menopause, Urogynaecology & Infections', count: 20, concepts: ['menopause', 'HRT', 'urinary incontinence', 'pelvic organ prolapse', 'vaginal discharge', 'pelvic inflammatory disease', 'chlamydia'] },
    ],
  },
  {
    subject: 'General Surgery',
    topics: [
      { chapter: 'Acute Abdomen', count: 30, concepts: ['appendicitis', 'bowel obstruction', 'perforated ulcer', 'acute cholecystitis', 'mesenteric ischaemia', 'diverticulitis', 'volvulus', 'acute pancreatitis'] },
      { chapter: 'Trauma (ATLS)', count: 25, concepts: ['primary survey', 'tension pneumothorax', 'haemothorax', 'haemorrhagic shock', 'head injury', 'splenic injury', 'FAST', 'burns', 'road traffic accident'] },
      { chapter: 'Hepatobiliary & Pancreas', count: 20, concepts: ['gallstones', 'choledocholithiasis', 'cholangitis', 'obstructive jaundice', 'pancreatic cancer', 'hydatid cyst', 'liver abscess'] },
      { chapter: 'Colorectal & Anal', count: 20, concepts: ['colorectal cancer', 'haemorrhoids', 'anal fissure', 'perianal abscess', 'pilonidal sinus', 'rectal bleeding'] },
      { chapter: 'Breast & Endocrine Surgery', count: 20, concepts: ['breast lump', 'triple assessment', 'breast cancer', 'fibroadenoma', 'mastitis', 'thyroid nodule', 'thyroidectomy complications'] },
      { chapter: 'Vascular', count: 15, concepts: ['acute limb ischaemia', 'peripheral arterial disease', 'abdominal aortic aneurysm', 'diabetic foot', 'varicose veins', 'DVT'] },
      { chapter: 'Hernia & Abdominal Wall', count: 15, concepts: ['inguinal hernia', 'femoral hernia', 'strangulated hernia', 'incisional hernia', 'umbilical hernia'] },
      { chapter: 'Upper GI Surgery', count: 15, concepts: ['oesophageal cancer', 'achalasia', 'gastric cancer', 'bariatric surgery', 'Boerhaave'] },
      { chapter: 'Urology', count: 20, concepts: ['renal colic', 'testicular torsion', 'BPH', 'urinary retention', 'prostate cancer', 'bladder cancer', 'haematuria'] },
      { chapter: 'Perioperative Care', count: 20, concepts: ['preoperative assessment', 'anticoagulation bridging', 'postoperative fever', 'fluid management', 'surgical site infection', 'local anaesthetic toxicity'] },
    ],
  },
  {
    subject: 'Preventive Medicine & Ethics',
    topics: [
      { chapter: 'Epidemiology & Biostatistics', count: 40, concepts: ['sensitivity', 'specificity', 'positive predictive value', 'relative risk', 'odds ratio', 'number needed to treat', 'study design', 'bias', 'confounding', 'incidence', 'prevalence', 'p value', 'confidence interval'] },
      { chapter: 'Screening & Health Promotion', count: 20, concepts: ['screening criteria', 'lead-time bias', 'premarital screening', 'newborn screening', 'cancer screening', 'smoking cessation'] },
      { chapter: 'Vaccination & Mass Gatherings', count: 25, concepts: ['Hajj', 'Umrah', 'meningococcal vaccine', 'influenza vaccine', 'outbreak', 'mass gathering', 'travel medicine'] },
      { chapter: 'Infection Prevention & Control', count: 20, concepts: ['MERS', 'hand hygiene', 'isolation precautions', 'needlestick injury', 'notifiable diseases', 'sterilisation'] },
      { chapter: 'Occupational & Environmental Health', count: 20, concepts: ['heat stroke', 'occupational lung disease', 'noise-induced hearing loss', 'lead poisoning', 'road traffic injury', 'water safety'] },
      { chapter: 'Medical Ethics & Islamic Bioethics', count: 35, concepts: ['informed consent', 'capacity', 'confidentiality', 'beneficence', 'autonomy', 'end-of-life', 'do not resuscitate', 'brain death', 'organ donation', 'Islamic bioethics', 'truth telling'] },
      { chapter: 'Professionalism & Health Law (Saudi/UAE)', count: 20, concepts: ['professionalism', 'medical error', 'disclosure', 'conflict of interest', 'boundaries', 'SCFHS', 'malpractice', 'documentation'] },
      { chapter: 'Communication & Consent', count: 20, concepts: ['breaking bad news', 'interpreter', 'minors consent', 'refusal of treatment', 'guardian', 'shared decision making'] },
    ],
  },
  {
    subject: 'Psychiatry',
    topics: [
      { chapter: 'Mood Disorders', count: 35, concepts: ['major depressive disorder', 'bipolar disorder', 'mania', 'suicide risk assessment', 'postpartum depression', 'SSRIs', 'lithium'] },
      { chapter: 'Psychotic Disorders', count: 30, concepts: ['schizophrenia', 'brief psychotic disorder', 'antipsychotics', 'neuroleptic malignant syndrome', 'clozapine', 'tardive dyskinesia'] },
      { chapter: 'Anxiety, OCD & Trauma', count: 30, concepts: ['generalised anxiety disorder', 'panic disorder', 'OCD', 'PTSD', 'social anxiety', 'phobia', 'somatic symptom disorder'] },
      { chapter: 'Substance Use', count: 25, concepts: ['alcohol withdrawal', 'Wernicke', 'opioid overdose', 'amphetamine', 'captagon', 'cannabis', 'benzodiazepine dependence'] },
      { chapter: 'Child & Adolescent Psychiatry', count: 20, concepts: ['ADHD', 'autism spectrum disorder', 'conduct disorder', 'enuresis', 'learning disability'] },
      { chapter: 'Neurocognitive Disorders', count: 20, concepts: ['delirium', 'dementia', 'Alzheimer', 'Lewy body'] },
      { chapter: 'Personality & Eating Disorders', count: 15, concepts: ['borderline personality disorder', 'anorexia nervosa', 'bulimia nervosa', 'refeeding syndrome'] },
      { chapter: 'Psychopharmacology & Emergencies', count: 25, concepts: ['serotonin syndrome', 'lithium toxicity', 'acute agitation', 'rapid tranquillisation', 'capacity assessment', 'involuntary admission'] },
    ],
  },
];

export const SUBJECT_SLUGS = {
  'Internal Medicine': 'internal-medicine',
  'General Surgery': 'general-surgery',
  Pediatrics: 'pediatrics',
  'Obstetrics & Gynecology': 'obgyn',
  'Preventive Medicine & Ethics': 'preventive-ethics',
  Psychiatry: 'psychiatry',
};

export function checkBlueprint() {
  for (const s of BLUEPRINT) {
    const total = s.topics.reduce((a, t) => a + t.count, 0);
    if (total !== TARGET_PER_SUBJECT) throw new Error(`${s.subject}: topic counts add up to ${total}, expected ${TARGET_PER_SUBJECT}`);
    if (!SUBJECT_SLUGS[s.subject]) throw new Error(`Unknown subject ${s.subject}`);
  }
}
