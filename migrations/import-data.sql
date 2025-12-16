-- CRM Data Import from InstantDB
-- Generated: 2025-12-16T02:43:53.462Z

-- Clear existing data first
TRUNCATE crm.blueprint_user_flows, crm.blueprint_signals, crm.blueprint_insights, crm.blueprint_issues, crm.blueprint_customers, crm.blueprint_integrations, crm.blueprint_workflows, crm.blueprints, crm.positioning_blocks, crm.docs, crm.issues, crm.backlog_items, crm.customer_attributes, crm.experiments, crm.insights, crm.signals, crm.sessions, crm.customers CASCADE;

-- Reset sequences
ALTER SEQUENCE crm.issue_key_seq RESTART WITH 1;

INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000001', 'Roef', 'Nikki, Joe, Kjell', '',
  'startup', 'lead',
  'https://roef.alive.best', NULL, NULL, NULL,
  NULL, NULL, NULL,
  '2025-12-04T12:49:26.373Z',
  '2025-12-04T12:49:26.373Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000002', 'Evermore Agency', 'Luuk van Dam', 'evermoreagencyy@gmail.com',
  'local business', 'lead',
  'https://ever-more.nl', NULL, NULL, NULL,
  NULL, NULL, NULL,
  '2025-12-05T10:49:08.803Z',
  '2025-12-05T10:49:24.927Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000003', 'First-Case', 'Ad', '',
  'local business', 'lead',
  'https://first-case.nl', 'moderne site, automatiseren van offertes, aanvraag verwerking en deel ontwerpproces', '', NULL,
  NULL, NULL, NULL,
  '2025-12-14T15:24:31.485Z',
  '2025-12-14T15:24:50.517Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000004', 'Time is the New Space', 'Wouter Marselje', '',
  'local business', 'lead',
  'https://timeisthenew.space', '', '', NULL,
  NULL, NULL, NULL,
  '2025-12-14T15:47:41.288Z',
  '2025-12-14T19:34:51.603Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000005', 'The Coffee Corner', 'Tom Nielsen', 'tom@coffeecorner.example',
  'local business', 'lead',
  'https://sites.alive.test/coffee-corner', 'Display menu and opening hours online', 'Schedule live build session with Tom', NULL,
  NULL, NULL, NULL,
  '2025-11-26T16:00:00.000Z',
  '2025-11-27T08:30:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000006', 'CodeCraft Agency', 'David Kim', 'david@codecraft.example',
  'studio', 'lost',
  'https://sites.alive.test/codecraft', 'Advanced customization for client branding', 'Document learnings about agency needs', NULL,
  NULL, NULL, NULL,
  '2025-10-28T13:00:00.000Z',
  '2025-11-15T10:00:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000007', 'Fotografie Emma', 'Emma Bakker', 'emma@fotografieemma.example',
  'freelancer', 'past',
  'https://sites.alive.test/fotografie-emma', 'Minimize site load time for image-heavy portfolio', 'Archive account after migration', NULL,
  NULL, NULL, NULL,
  '2025-10-15T09:00:00.000Z',
  '2025-11-10T12:00:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000008', 'Pixel & Clay', 'Ruben Jansen', 'ruben@pixelandclay.example',
  'studio', 'lead',
  'https://sites.alive.test/pixel-and-clay', 'Create a modern portfolio site', 'Complete onboarding workshop next week', NULL,
  NULL, NULL, NULL,
  '2025-11-21T14:00:00.000Z',
  '2025-11-22T16:45:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000009', 'Green Therapy', 'Sophie Martin', 'sophie@greentherapy.example',
  'local business', 'active',
  'https://sites.alive.test/green-therapy', 'Integrate online booking system', 'Connect with booking platform partner', NULL,
  NULL, NULL, NULL,
  '2025-11-22T11:00:00.000Z',
  '2025-11-27T09:15:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000010', 'Creative Minds Studio', 'Lisa Anderson', 'lisa@creativeminds.example',
  'studio', 'active',
  'https://sites.alive.test/creative-minds', 'Showcase client work visually with case studies', 'Improve mobile editing experience', NULL,
  NULL, NULL, NULL,
  '2025-11-14T10:30:00.000Z',
  '2025-11-26T14:00:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000011', 'Bloom & Grow', 'Olivia Brown', 'olivia@bloomandgrow.example',
  'startup', 'lead',
  'https://sites.alive.test/bloom-grow', 'Affordable MVP landing page for validation', 'Propose new starter plan pricing to team', NULL,
  NULL, NULL, NULL,
  '2025-11-25T14:30:00.000Z',
  '2025-11-27T11:00:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000012', 'Green Therapy', 'Sophie Martin', 'sophie@greentherapy.example',
  'local business', 'active',
  'https://sites.alive.test/green-therapy', 'Integrate online booking system', 'Connect with booking platform partner', NULL,
  NULL, NULL, NULL,
  '2025-11-22T11:00:00.000Z',
  '2025-11-27T09:15:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000013', 'Creative Minds Studio', 'Lisa Anderson', 'lisa@creativeminds.example',
  'studio', 'active',
  'https://sites.alive.test/creative-minds', 'Showcase client work visually with case studies', 'Improve mobile editing experience', NULL,
  NULL, NULL, NULL,
  '2025-11-14T10:30:00.000Z',
  '2025-11-26T14:00:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000014', 'GrowthLabs', 'Marcus Chen', 'marcus@growthlabs.example',
  'startup', 'active',
  'https://sites.alive.test/growthlabs', 'Validate product messaging with landing page', 'Run A/B test on hero copy and measure conversion', NULL,
  NULL, NULL, NULL,
  '2025-11-18T13:00:00.000Z',
  '2025-11-27T15:20:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000015', 'Pixel & Clay', 'Ruben Jansen', 'ruben@pixelandclay.example',
  'studio', 'lead',
  'https://sites.alive.test/pixel-and-clay', 'Create a modern portfolio site', 'Complete onboarding workshop next week', NULL,
  NULL, NULL, NULL,
  '2025-11-21T14:00:00.000Z',
  '2025-11-22T16:45:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000016', 'Bloom & Grow', 'Olivia Brown', 'olivia@bloomandgrow.example',
  'startup', 'lead',
  'https://sites.alive.test/bloom-grow', 'Affordable MVP landing page for validation', 'Propose new starter plan pricing to team', NULL,
  NULL, NULL, NULL,
  '2025-11-25T14:30:00.000Z',
  '2025-11-27T11:00:00.000Z'
);
INSERT INTO crm.customers (id, company, contact, contact_email, type, status, site_url, customer_goal, next_steps, next_step, next_step_due, owner, last_touch_at, created_at, updated_at) VALUES (
  '00000000-0000-0000-0001-000000000017', 'The Coffee Corner', 'Tom Nielsen', 'tom@coffeecorner.example',
  'local business', 'lead',
  'https://sites.alive.test/coffee-corner', 'Display menu and opening hours online', 'Schedule live build session with Tom', NULL,
  NULL, NULL, NULL,
  '2025-11-26T16:00:00.000Z',
  '2025-11-27T08:30:00.000Z'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000002',
  '2025-12-05T07:33:00.000Z',
  'discovery call', 'Untitled Session', '<p>Evermore wilt:<br>- Duur gevoel, snel, strak.<br>- Gelijk de artiesten zien bij openen site<br>- De artiesten grid op voorpagina moet blijven, maar moet veel strakker<br>- Logo’s van bedrijven op mooie manier verwerken<br>- Mooie animaties verwerken (bv. Met de artiesten cards)<br>- Info waar evermore voor staat in animaties verwerken. <br>- Willen goed balans tussen: In 1 scroll alles zien vs. Duidelijkheid houden en niet overzicht kwijtraken</p><p>Ze hebben:<br>- Visual content van de artiesten<br>- Branding folder<br>- porpora font<br>- Logos in al formats</p><p>Concurrenten zijn:<br>- https://www.wmeagency.com<br>- https://www.teamwass.com</p><p>Kosten<br>- 40 euro per maand voor hele pakket. Vindt Luuk een nette prijs, zolang echt alles is inbegrepen.<br>- Met Lars overleggen of er extra kosten bijkomen voor complexe automations, maar we zijn het erover eens dat we hier samen uitkomen en een win-win situatie kunnen maken.<br>- Staan er voor open om powered by / made by Alive onderaan de site toe te voegen.</p><p>Next steps Evermore:<br>- Ze sturen ons:<br>- Webflow templates, met korte uitleg waarom deze zijn gekozen<br>- Branding content</p><p>Next steps Alive:<br>- Gieten evermore site in nieuw design gebaseerd op hun input</p>', 'bb'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000002',
  '2025-12-08T18:15:00.000Z',
  'live build session', 'Untitled Session', '<p>1<br>Mooie template, laten er even samen doorheen lopen, en de tweaks bespreken.</p><p>- Op de homepage, ipv work, artiesten<br>- En dan 4 artiesten naast elkaar, en een groep van 9/10 laten zien, en daaronder een knop met bekijk alle. <br>- De gradient animaties op de homepage kunnen hetzelfde blijven. Misschien later aanpassen naar artiesten foto carousel.<br>￼<br>- Dat laadscherm met logo op bij de home page is nice. Zwart, met logo in hun kleur (mint).<br>- Achtergrond. Beige = mint. Zwart = hun zwart. <br>￼<br>- Meeste van hun klanten zitten op hun laptop (dus belangrijker dan mobile). <br>- Logo’s gedeelte hetzelfde houden, logos mogen wat sneller en wellicht met je muis kunnen laten bewegen. <br>- Contact (top vd homepage) zelfde houden, maar dan een contact icoon ipv foto van 1 iemand.<br>- In het side menu: YouTube ipv twitter, rest hetzelfde. <br>- Menu items overnemen zoals op hun oude evermore website. <br>- Al die oranje bolletjes met getallen kunnen weg uit template. <br>￼<br>- Die animaties in about us kunnen hetzelfde. <br>- Services kunnen core values worden<br>- ￼<br>- De laatst gemaakte docu kan op de video plek op de homepage<br>￼<br>- FAQ kunnen we laten staan. <br>- Start your project with allure, dan gezichten met artiesten. <br>- Klikken op bekijk alle artiesten. <br>- Work/selected work wordt artiesten, <br>- Meanwhile.nl<br>- Eerst roster als losse namen, en dan een grid.<br>￼<br>- De pagina van 1 artiest, kan meer in hun oorspronkelijk <br>- Our studio, wordt ‘about us’ <br>- Blog kunnen we skippen<br>- Jobs kan evt. In het blog format<br>- Contact pagina ziet er goed uit, zelfde houden</p><p>2<br>Nog even de kosten besproken zoals hieronder:<br>- 40 eu per maand<br>- Complete website <br>- Toegang tot de terminal, met 20 eu aan credits (kunnen ze lovable opzeggen)<br>- Dashboard overzetten<br>- Laten we die automations hierbuiten houden<br>Luuk begrijpt dat we niet voor deze prijs allerlei automations gaan inbouwen, en verwacht dit ook later niet van ons.</p>', 'bb'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000009',
  '2025-11-22T13:30:00.000Z',
  'discovery call', 'Therapist wants website with booking and contact features', 'Sophie mentioned wanting a calm, professional feel. Needs online booking integration.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000006',
  '2025-11-05T11:00:00.000Z',
  'email thread', 'Concerns about editor flexibility for custom branding', 'David needed more granular control over typography and spacing. Switched to Webflow.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000010',
  '2025-11-15T10:00:00.000Z',
  'live build session', 'Built portfolio site for design studio together', 'Lisa wanted showcase for client projects. Emphasized visual presentation and case studies.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000005',
  '2025-11-26T17:00:00.000Z',
  'discovery call', 'Coffee shop owner exploring website options', '<p>Tom wants to display menu and opening hours; needs updates to be simple and fast.</p>', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000007',
  '2025-10-20T14:30:00.000Z',
  'discovery call', 'Photographer looking for minimal portfolio site', 'Wanted very simple design; concerned about loading speed for large images.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000008',
  '2025-11-22T13:00:00.000Z',
  'usability test', 'Observed first-time onboarding for studio use case', 'They tried to generate site from scratch; some confusion about prompts and templates.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0001-000000000010',
  '2025-11-24T14:00:00.000Z',
  'usability test', 'Observed Lisa editing existing project descriptions', 'She struggled to find the edit button on mobile; eventually switched to desktop.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000010', '00000000-0000-0000-0001-000000000011',
  '2025-11-25T16:00:00.000Z',
  'discovery call', 'Startup founder wants to validate product-market fit', 'Olivia needs a landing page fast to test messaging with potential customers. Budget-conscious.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000011', '00000000-0000-0000-0001-000000000009',
  '2025-11-26T15:00:00.000Z',
  'follow-up call', 'Discussed pricing page and plan features', 'She was confused about whether the starter plan included custom domains.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000012', '00000000-0000-0000-0001-000000000012',
  '2025-11-22T13:30:00.000Z',
  'discovery call', 'Therapist wants website with booking and contact features', 'Sophie mentioned wanting a calm, professional feel. Needs online booking integration.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000013', '00000000-0000-0000-0001-000000000015',
  '2025-11-22T13:00:00.000Z',
  'usability test', 'Observed first-time onboarding for studio use case', 'They tried to generate site from scratch; some confusion about prompts and templates.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000014', '00000000-0000-0000-0001-000000000013',
  '2025-11-15T10:00:00.000Z',
  'live build session', 'Built portfolio site for design studio together', 'Lisa wanted showcase for client projects. Emphasized visual presentation and case studies.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000015', '00000000-0000-0000-0001-000000000014',
  '2025-11-18T16:00:00.000Z',
  'discovery call', 'Startup founder wants landing page to validate product idea', 'Needs quick iteration; wants to A/B test messaging without touching code.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000016', '00000000-0000-0000-0001-000000000014',
  '2025-11-25T11:00:00.000Z',
  'email thread', 'Feedback on pricing page clarity', 'Marcus sent screenshots showing confusion about which plan includes custom domains.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000017', '00000000-0000-0000-0001-000000000017',
  '2025-11-26T17:00:00.000Z',
  'discovery call', 'Coffee shop owner exploring website options', 'Tom wants to display menu and opening hours; needs updates to be simple and fast.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000018', '00000000-0000-0000-0001-000000000016',
  '2025-11-25T16:00:00.000Z',
  'discovery call', 'Startup founder wants to validate product-market fit', 'Olivia needs a landing page fast to test messaging with potential customers. Budget-conscious.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000019', '00000000-0000-0000-0001-000000000012',
  '2025-11-26T15:00:00.000Z',
  'follow-up call', 'Discussed pricing page and plan features', 'She was confused about whether the starter plan included custom domains.', 'BB'
);
INSERT INTO crm.sessions (id, customer_id, date, type, title, notes, created_by) VALUES (
  '00000000-0000-0000-0002-000000000020', '00000000-0000-0000-0001-000000000013',
  '2025-11-24T14:00:00.000Z',
  'usability test', 'Observed Lisa editing existing project descriptions', 'She struggled to find the edit button on mobile; eventually switched to desktop.', 'BB'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0001-000000000011',
  '00000000-0000-0000-0002-000000000010',
  'For a startup, spending $50/month on a website feels steep when I''m still validating the idea.', 'Pain', 'Pricing',
  'Medium', 'Early-stage budget constraints', 'When I''m trying to build an MVP landing page on a tight budget',
  'I want an affordable way to test my idea online', 'so I can save money for actual product development.', 'draft',
  NULL,
  '2025-11-25T16:20:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0001-000000000010',
  '00000000-0000-0000-0002-000000000005',
  'Being able to showcase our work visually is crucial for attracting new clients.', 'Insight', 'Branding',
  'High', 'Visual showcase importance', 'When potential clients visit our portfolio',
  'I want them to immediately see the quality and style of our work', 'so they feel confident reaching out for a project.', 'draft',
  NULL,
  '2025-11-15T10:30:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0001-000000000009',
  '00000000-0000-0000-0002-000000000011',
  'I assumed the starter plan had custom domains because the competitor''s basic plan does.', 'Assumption', 'Pricing',
  'Medium', 'Pricing expectations', 'When I first looked at your pricing tiers',
  'I want to know what features are standard vs premium', 'so I don''t get surprised after signing up.', 'draft',
  NULL,
  '2025-11-26T15:15:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0001-000000000011',
  '00000000-0000-0000-0002-000000000010',
  'Speed is everything - I''d rather have a decent site in 30 minutes than a perfect one in 2 weeks.', 'Insight', 'Onboarding',
  'High', 'Speed over perfection', 'When I''m launching a new product experiment',
  'I want to get online and start getting feedback immediately', 'so I can iterate based on real customer responses.', 'draft',
  NULL,
  '2025-11-25T16:25:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000005', '00000000-0000-0000-0001-000000000010',
  '00000000-0000-0000-0002-000000000009',
  'On mobile, the edit button was too small and hard to find - I gave up and used my laptop.', 'Pain', 'Editor',
  'High', 'Mobile editing difficulty', 'When I want to quickly update a project description from my phone',
  'I want editing to work smoothly on any device', 'so I''m not forced to wait until I have my laptop.', 'draft',
  NULL,
  '2025-11-24T14:20:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000006', '00000000-0000-0000-0001-000000000008',
  '00000000-0000-0000-0002-000000000008',
  'I would rather pick from 3-4 starting layouts instead of writing everything from scratch.', 'Wish', 'Onboarding',
  'Medium', 'Template-first onboarding', 'When I''m trying a new site builder',
  'I want to see some concrete options', 'so I can choose quickly and tweak instead of inventing.', 'draft',
  NULL,
  '2025-11-22T13:25:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000007', '00000000-0000-0000-0001-000000000006',
  '00000000-0000-0000-0002-000000000004',
  'We need more control over typography, spacing, and custom CSS for client branding.', 'Pain', 'Editor',
  'High', 'Advanced customization needs', 'When we''re building sites for clients with strict brand guidelines',
  'I want pixel-perfect control over every design element', 'so we can match their existing brand identity exactly.', 'draft',
  NULL,
  '2025-11-05T11:20:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000008', '00000000-0000-0000-0001-000000000008',
  '00000000-0000-0000-0002-000000000008',
  'This first screen asks for a lot of text; I''m not sure what to write here.', 'Pain', 'Onboarding',
  'Medium', 'Hard to start', 'When I first try to generate a site for my studio',
  'I want to get started without overthinking the content', 'so I don''t feel stuck before I even see a first version.', 'draft',
  NULL,
  '2025-11-22T13:20:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000009', '00000000-0000-0000-0001-000000000005',
  '00000000-0000-0000-0002-000000000006',
  'I just need to update our daily menu and opening hours - nothing fancy.', 'Insight', 'Editor',
  'Medium', 'Simple updates', 'When I need to change business information on the website',
  'I want the simplest possible way to make basic edits', 'so I can spend my time running the business instead.', 'draft',
  NULL,
  '2025-11-26T17:15:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000010', '00000000-0000-0000-0001-000000000014',
  '00000000-0000-0000-0002-000000000016',
  'The pricing page doesn''t make it obvious which plan includes custom domains.', 'Pain', 'Pricing',
  'High', 'Pricing clarity', 'When I''m comparing plans to decide what to subscribe to',
  'I want to clearly see what''s included in each tier', 'so I can make an informed decision without contacting support.', 'draft',
  NULL,
  '2025-11-25T11:20:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000011', '00000000-0000-0000-0001-000000000016',
  '00000000-0000-0000-0002-000000000018',
  'Speed is everything - I''d rather have a decent site in 30 minutes than a perfect one in 2 weeks.', 'Insight', 'Onboarding',
  'High', 'Speed over perfection', 'When I''m launching a new product experiment',
  'I want to get online and start getting feedback immediately', 'so I can iterate based on real customer responses.', 'draft',
  NULL,
  '2025-11-25T16:25:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000012', '00000000-0000-0000-0001-000000000013',
  '00000000-0000-0000-0002-000000000014',
  'Being able to showcase our work visually is crucial for attracting new clients.', 'Insight', 'Branding',
  'High', 'Visual showcase importance', 'When potential clients visit our portfolio',
  'I want them to immediately see the quality and style of our work', 'so they feel confident reaching out for a project.', 'draft',
  NULL,
  '2025-11-15T10:30:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000013', '00000000-0000-0000-0001-000000000016',
  '00000000-0000-0000-0002-000000000018',
  'For a startup, spending $50/month on a website feels steep when I''m still validating the idea.', 'Pain', 'Pricing',
  'Medium', 'Early-stage budget constraints', 'When I''m trying to build an MVP landing page on a tight budget',
  'I want an affordable way to test my idea online', 'so I can save money for actual product development.', 'draft',
  NULL,
  '2025-11-25T16:20:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000014', '00000000-0000-0000-0001-000000000017',
  '00000000-0000-0000-0002-000000000017',
  'I just need to update our daily menu and opening hours - nothing fancy.', 'Insight', 'Editor',
  'Medium', 'Simple updates', 'When I need to change business information on the website',
  'I want the simplest possible way to make basic edits', 'so I can spend my time running the business instead.', 'draft',
  NULL,
  '2025-11-26T17:15:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000015', '00000000-0000-0000-0001-000000000014',
  '00000000-0000-0000-0002-000000000015',
  'I need to test different headlines quickly without waiting for a developer.', 'Wish', 'Editor',
  'High', 'Quick iteration', 'When I want to A/B test messaging on my landing page',
  'I want to change the text instantly and see how it performs', 'so I can validate my product positioning faster.', 'draft',
  NULL,
  '2025-11-18T16:30:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000016', '00000000-0000-0000-0001-000000000015',
  '00000000-0000-0000-0002-000000000013',
  'This first screen asks for a lot of text; I''m not sure what to write here.', 'Pain', 'Onboarding',
  'Medium', 'Hard to start', 'When I first try to generate a site for my studio',
  'I want to get started without overthinking the content', 'so I don''t feel stuck before I even see a first version.', 'draft',
  NULL,
  '2025-11-22T13:20:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000017', '00000000-0000-0000-0001-000000000012',
  '00000000-0000-0000-0002-000000000019',
  'I assumed the starter plan had custom domains because the competitor''s basic plan does.', 'Assumption', 'Pricing',
  'Medium', 'Pricing expectations', 'When I first looked at your pricing tiers',
  'I want to know what features are standard vs premium', 'so I don''t get surprised after signing up.', 'draft',
  NULL,
  '2025-11-26T15:15:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000018', '00000000-0000-0000-0001-000000000015',
  '00000000-0000-0000-0002-000000000013',
  'I would rather pick from 3-4 starting layouts instead of writing everything from scratch.', 'Wish', 'Onboarding',
  'Medium', 'Template-first onboarding', 'When I''m trying a new site builder',
  'I want to see some concrete options', 'so I can choose quickly and tweak instead of inventing.', 'draft',
  NULL,
  '2025-11-22T13:25:00.000Z'
);
INSERT INTO crm.insights (id, customer_id, session_id, text, kind, topic, confidence, cluster, job_situation, job_motivation, job_outcome, insight_status, source_signal_id, created_at) VALUES (
  '00000000-0000-0000-0004-000000000019', '00000000-0000-0000-0001-000000000013',
  '00000000-0000-0000-0002-000000000020',
  'On mobile, the edit button was too small and hard to find - I gave up and used my laptop.', 'Pain', 'Editor',
  'High', 'Mobile editing difficulty', 'When I want to quickly update a project description from my phone',
  'I want editing to work smoothly on any device', 'so I''m not forced to wait until I have my laptop.', 'draft',
  NULL,
  '2025-11-24T14:20:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000001', 'Introduce $15/month validation tier for startups', 'Experiment', 'Planned',
  'Pricing', 'Early-stage startups find the $50/month price too high for MVP validation.', 'Because startups need affordable validation (Insight ins_14), introducing a $15/month ''Validation'' tier with basic features will capture startup customers who would otherwise not sign up.',
  'Create a new pricing tier at $15/month with: 1 site, basic templates, community support, and Alive subdomain only (no custom domain). Position it as ''perfect for testing your idea.''', 'Total monthly revenue from startup segment', '$2,100/month',
  '$4,500/month', '', '',
  '{"00000000-0000-0000-0004-000000000001"}'::uuid[],
  '2025-11-26T15:00:00.000Z',
  '2025-11-27T10:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000002', 'Show customer success examples on homepage', 'Design change', 'Running',
  'Brand', 'We have positive customer feedback but don''t showcase it prominently to build trust.', 'Because customers like seeing real results (Insight ins_6), adding a ''Customer Highlights'' section with 2-3 brief success stories will increase homepage-to-trial conversion.',
  'Add a section above the footer showing 3 customer cards: photo, name, business type, and a one-sentence quote about their result (e.g., ''Our bakery gets more online orders since we updated daily specials on our Alive site'').', 'Overall homepage-to-trial conversion rate', '6.5%',
  '8%', '', '',
  '{}'::uuid[],
  '2025-11-26T14:00:00.000Z',
  '2025-11-27T09:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000003', 'Hero text without the word ''prompt''', 'Experiment', 'Live',
  'Onboarding', 'Several users do not understand the word ''prompt'' in the hero and feel uncertain about what Alive does.', 'Because users are confused by the word ''prompt'' (Insights ins_1 and ins_3), we believe that replacing it with plain language will increase the percentage of visitors who start generating a site.',
  'Update hero copy from ''Create a site from one prompt'' to ''Describe your idea and get a complete website in minutes.''', '% visitors who click the primary "Start your site" CTA', '12%',
  '18%', '21%', 'Ship it - the clearer language significantly improved conversion. Keep monitoring for a week to ensure it holds.',
  '{"00000000-0000-0000-0004-000000000008"}'::uuid[],
  '2025-11-20T11:00:00.000Z',
  '2025-11-27T14:30:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000004', 'Template-first onboarding flow for small studios', 'Experiment', 'Planned',
  'Onboarding', 'Studio users feel blocked by having to write a lot of text before they can see anything.', 'Because studio users prefer choosing from layouts instead of writing from scratch (Insights ins_3 and ins_4), we believe that offering 3-4 starting templates will increase the percentage of studio signups who reach a first generated site.',
  'Add a step to onboarding where studio users can pick from 4 predefined layouts (portfolio, agency, product showcase, minimal), each with sample content they can later edit.', '% studio signups who reach first generated site', '45%',
  '65%', '', '',
  '{"00000000-0000-0000-0004-000000000008","00000000-0000-0000-0004-000000000006"}'::uuid[],
  '2025-11-23T11:10:00.000Z',
  '2025-11-23T11:10:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000005', 'Highlight editing areas with subtle borders on hover', 'Design change', 'Live',
  'Editor', 'Non-technical users don''t know where to click to edit content on their site.', 'Because non-technical users need clear visual cues (Insight ins_5), we believe that adding subtle borders on hover will help them find editable areas faster.',
  'When users hover over any editable text or image area, show a light blue border with a small ''Edit'' label in the top-right corner.', 'Average time to first edit (seconds)', '45s',
  '25s', '22s', 'Shipped - users found edit areas 50% faster. Also reduced support questions about ''how to change text'' by 30%.',
  '{}'::uuid[],
  '2025-11-22T09:00:00.000Z',
  '2025-11-26T16:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000006', 'Create ''Business Basics'' template for local shops', 'Experiment', 'Idea',
  'Onboarding', 'Local business owners want simple sites but feel overwhelmed by customization options.', 'Because local business owners need simple updates (Insight ins_12), providing a pre-built ''Business Basics'' template with menu, hours, and contact sections will increase local business signup-to-publish rate.',
  'Create a new template specifically for local businesses with sections for: business hours, menu/services, location map, contact form. Pre-populate with placeholder content that''s easy to replace.', '% local business signups who publish a site within 48 hours', '32%',
  '55%', '', '',
  '{"00000000-0000-0000-0004-000000000009"}'::uuid[],
  '2025-11-27T11:00:00.000Z',
  '2025-11-27T11:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000007', 'Add advanced CSS customization for Pro plan', 'Decision', 'Scrapped',
  'Editor', 'Design agencies need pixel-perfect control over typography and spacing for client branding.', 'Because agencies need advanced customization (Insight ins_13), adding custom CSS editing as a Pro feature will attract agency customers and reduce churn.',
  'Add a ''Custom CSS'' panel in the editor for Pro plan users, allowing them to write custom styles with syntax highlighting and live preview.', '% agency signups who upgrade to Pro plan', '8%',
  '25%', '', 'Scrapped - This takes us too far from our core value proposition of simplicity. Agencies needing this level of control should use Webflow or custom code. We''ll focus on our strength: speed and ease for non-technical users.',
  '{"00000000-0000-0000-0004-000000000007"}'::uuid[],
  '2025-11-10T14:00:00.000Z',
  '2025-11-18T16:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000008', 'Add 30-minute quick-start video tutorial', 'Design change', 'Running',
  'Onboarding', 'Startups and freelancers want to launch fast but don''t know the most efficient workflow.', 'Because users value speed over perfection (Insights ins_2 and ins_15), providing a 30-minute video showing the fastest path to publishing will increase day-1 publish rate.',
  'Record and embed a 30-minute ''Launch Your Site Today'' tutorial showing: template selection, basic customization, domain setup, and publishing. Feature it prominently in onboarding email and dashboard.', '% new signups who publish within 24 hours', '18%',
  '35%', '', '',
  '{"00000000-0000-0000-0004-000000000004"}'::uuid[],
  '2025-11-24T10:00:00.000Z',
  '2025-11-27T08:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000009', 'Improve mobile editor touch targets', 'Design change', 'Running',
  'Editor', 'Mobile users struggle to find and tap edit buttons due to small touch targets.', 'Because mobile editing is difficult (Insight ins_10), increasing touch target sizes and adding visual feedback will reduce mobile editing friction and increase mobile edit completion rate.',
  'Increase edit button size on mobile to minimum 44x44px. Add subtle pulsing animation on first mobile visit to guide users. Show toast confirmation after successful edits.', '% mobile sessions that complete at least one edit', '28%',
  '45%', '', '',
  '{"00000000-0000-0000-0004-000000000005"}'::uuid[],
  '2025-11-25T09:00:00.000Z',
  '2025-11-27T14:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000010', 'Add ''Quick Start in 60 Minutes'' promise to homepage', 'Design change', 'Idea',
  'Onboarding', 'Freelancers value speed but we don''t explicitly promise how fast they can launch.', 'Because freelancers want to launch quickly (Insight ins_2), explicitly promising ''60 minutes to a live site'' will increase trial signups from freelancers.',
  'Add a badge or callout near the hero that says ''From idea to live site in under 60 minutes'' with a small timer icon.', '% freelancer visitors who start trial', '8%',
  '12%', '', '',
  '{}'::uuid[],
  '2025-11-27T10:00:00.000Z',
  '2025-11-27T10:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000011', 'Add feature comparison table to pricing page', 'Design change', 'Planned',
  'Pricing', 'Users are confused about what features are included in each pricing tier.', 'Because users can''t easily compare plan features (Insights ins_8 and ins_9), adding a clear comparison table will reduce confusion and increase conversion from free to paid.',
  'Add a detailed feature comparison table showing all plans side-by-side with checkmarks for included features. Highlight custom domains, storage limits, and support level for each tier.', '% visitors who upgrade from starter to premium plan', '11%',
  '16%', '', '',
  '{"00000000-0000-0000-0004-000000000003"}'::uuid[],
  '2025-11-26T10:00:00.000Z',
  '2025-11-26T10:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000012', 'Add ''Quick Start in 60 Minutes'' promise to homepage', 'Design change', 'Idea',
  'Onboarding', 'Freelancers value speed but we don''t explicitly promise how fast they can launch.', 'Because freelancers want to launch quickly (Insight ins_2), explicitly promising ''60 minutes to a live site'' will increase trial signups from freelancers.',
  'Add a badge or callout near the hero that says ''From idea to live site in under 60 minutes'' with a small timer icon.', '% freelancer visitors who start trial', '8%',
  '12%', '', '',
  '{}'::uuid[],
  '2025-11-27T10:00:00.000Z',
  '2025-11-27T10:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000013', 'Add advanced CSS customization for Pro plan', 'Decision', 'Scrapped',
  'Editor', 'Design agencies need pixel-perfect control over typography and spacing for client branding.', 'Because agencies need advanced customization (Insight ins_13), adding custom CSS editing as a Pro feature will attract agency customers and reduce churn.',
  'Add a ''Custom CSS'' panel in the editor for Pro plan users, allowing them to write custom styles with syntax highlighting and live preview.', '% agency signups who upgrade to Pro plan', '8%',
  '25%', '', 'Scrapped - This takes us too far from our core value proposition of simplicity. Agencies needing this level of control should use Webflow or custom code. We''ll focus on our strength: speed and ease for non-technical users.',
  '{}'::uuid[],
  '2025-11-10T14:00:00.000Z',
  '2025-11-18T16:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000014', 'Template-first onboarding flow for small studios', 'Experiment', 'Planned',
  'Onboarding', 'Studio users feel blocked by having to write a lot of text before they can see anything.', 'Because studio users prefer choosing from layouts instead of writing from scratch (Insights ins_3 and ins_4), we believe that offering 3-4 starting templates will increase the percentage of studio signups who reach a first generated site.',
  'Add a step to onboarding where studio users can pick from 4 predefined layouts (portfolio, agency, product showcase, minimal), each with sample content they can later edit.', '% studio signups who reach first generated site', '45%',
  '65%', '', '',
  '{"00000000-0000-0000-0004-000000000016","00000000-0000-0000-0004-000000000018"}'::uuid[],
  '2025-11-23T11:10:00.000Z',
  '2025-11-23T11:10:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000015', 'Improve mobile editor touch targets', 'Design change', 'Running',
  'Editor', 'Mobile users struggle to find and tap edit buttons due to small touch targets.', 'Because mobile editing is difficult (Insight ins_10), increasing touch target sizes and adding visual feedback will reduce mobile editing friction and increase mobile edit completion rate.',
  'Increase edit button size on mobile to minimum 44x44px. Add subtle pulsing animation on first mobile visit to guide users. Show toast confirmation after successful edits.', '% mobile sessions that complete at least one edit', '28%',
  '45%', '', '',
  '{"00000000-0000-0000-0004-000000000019"}'::uuid[],
  '2025-11-25T09:00:00.000Z',
  '2025-11-27T14:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000016', 'Introduce $15/month validation tier for startups', 'Experiment', 'Planned',
  'Pricing', 'Early-stage startups find the $50/month price too high for MVP validation.', 'Because startups need affordable validation (Insight ins_14), introducing a $15/month ''Validation'' tier with basic features will capture startup customers who would otherwise not sign up.',
  'Create a new pricing tier at $15/month with: 1 site, basic templates, community support, and Alive subdomain only (no custom domain). Position it as ''perfect for testing your idea.''', 'Total monthly revenue from startup segment', '$2,100/month',
  '$4,500/month', '', '',
  '{"00000000-0000-0000-0004-000000000013"}'::uuid[],
  '2025-11-26T15:00:00.000Z',
  '2025-11-27T10:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000017', 'Show customer success examples on homepage', 'Design change', 'Running',
  'Brand', 'We have positive customer feedback but don''t showcase it prominently to build trust.', 'Because customers like seeing real results (Insight ins_6), adding a ''Customer Highlights'' section with 2-3 brief success stories will increase homepage-to-trial conversion.',
  'Add a section above the footer showing 3 customer cards: photo, name, business type, and a one-sentence quote about their result (e.g., ''Our bakery gets more online orders since we updated daily specials on our Alive site'').', 'Overall homepage-to-trial conversion rate', '6.5%',
  '8%', '', '',
  '{}'::uuid[],
  '2025-11-26T14:00:00.000Z',
  '2025-11-27T09:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000018', 'Create ''Business Basics'' template for local shops', 'Experiment', 'Idea',
  'Onboarding', 'Local business owners want simple sites but feel overwhelmed by customization options.', 'Because local business owners need simple updates (Insight ins_12), providing a pre-built ''Business Basics'' template with menu, hours, and contact sections will increase local business signup-to-publish rate.',
  'Create a new template specifically for local businesses with sections for: business hours, menu/services, location map, contact form. Pre-populate with placeholder content that''s easy to replace.', '% local business signups who publish a site within 48 hours', '32%',
  '55%', '', '',
  '{"00000000-0000-0000-0004-000000000014"}'::uuid[],
  '2025-11-27T11:00:00.000Z',
  '2025-11-27T11:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000019', 'Add 30-minute quick-start video tutorial', 'Design change', 'Running',
  'Onboarding', 'Startups and freelancers want to launch fast but don''t know the most efficient workflow.', 'Because users value speed over perfection (Insights ins_2 and ins_15), providing a 30-minute video showing the fastest path to publishing will increase day-1 publish rate.',
  'Record and embed a 30-minute ''Launch Your Site Today'' tutorial showing: template selection, basic customization, domain setup, and publishing. Feature it prominently in onboarding email and dashboard.', '% new signups who publish within 24 hours', '18%',
  '35%', '', '',
  '{"00000000-0000-0000-0004-000000000011"}'::uuid[],
  '2025-11-24T10:00:00.000Z',
  '2025-11-27T08:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000020', 'Hero text without the word ''prompt''', 'Experiment', 'Live',
  'Onboarding', 'Several users do not understand the word ''prompt'' in the hero and feel uncertain about what Alive does.', 'Because users are confused by the word ''prompt'' (Insights ins_1 and ins_3), we believe that replacing it with plain language will increase the percentage of visitors who start generating a site.',
  'Update hero copy from ''Create a site from one prompt'' to ''Describe your idea and get a complete website in minutes.''', '% visitors who click the primary "Start your site" CTA', '12%',
  '18%', '21%', 'Ship it - the clearer language significantly improved conversion. Keep monitoring for a week to ensure it holds.',
  '{"00000000-0000-0000-0004-000000000016"}'::uuid[],
  '2025-11-20T11:00:00.000Z',
  '2025-11-27T14:30:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000021', 'Add feature comparison table to pricing page', 'Design change', 'Planned',
  'Pricing', 'Users are confused about what features are included in each pricing tier.', 'Because users can''t easily compare plan features (Insights ins_8 and ins_9), adding a clear comparison table will reduce confusion and increase conversion from free to paid.',
  'Add a detailed feature comparison table showing all plans side-by-side with checkmarks for included features. Highlight custom domains, storage limits, and support level for each tier.', '% visitors who upgrade from starter to premium plan', '11%',
  '16%', '', '',
  '{"00000000-0000-0000-0004-000000000010","00000000-0000-0000-0004-000000000017"}'::uuid[],
  '2025-11-26T10:00:00.000Z',
  '2025-11-26T10:00:00.000Z'
);
INSERT INTO crm.experiments (id, title, type, status, area, problem, hypothesis, change_description, metric, baseline, target, result, decision, insight_ids, created_at, updated_at) VALUES (
  '00000000-0000-0000-0005-000000000022', 'Highlight editing areas with subtle borders on hover', 'Design change', 'Live',
  'Editor', 'Non-technical users don''t know where to click to edit content on their site.', 'Because non-technical users need clear visual cues (Insight ins_5), we believe that adding subtle borders on hover will help them find editable areas faster.',
  'When users hover over any editable text or image area, show a light blue border with a small ''Edit'' label in the top-right corner.', 'Average time to first edit (seconds)', '45s',
  '25s', '22s', 'Shipped - users found edit areas 50% faster. Also reduced support questions about ''how to change text'' by 30%.',
  '{}'::uuid[],
  '2025-11-22T09:00:00.000Z',
  '2025-11-26T16:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000006', 'segment', 'Design agency',
  '2025-10-28T13:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000010', 'segment', 'Creative agency',
  '2025-11-14T10:30:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000009', 'segment', 'Health & wellness',
  '2025-11-22T13:30:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000006', 'churn_reason', 'Needed advanced CSS customization',
  '2025-11-15T10:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000008', 'segment', 'Design studio',
  '2025-11-22T14:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000011', 'segment', 'Consumer product startup',
  '2025-11-25T14:30:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000011', 'budget_sensitivity', 'High',
  '2025-11-25T16:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000010', 'primary_use_case', 'Portfolio showcase',
  '2025-11-15T10:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000005', 'segment', 'Food & beverage',
  '2025-11-26T16:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000014', 'company_size', '2-5 employees',
  '2025-11-18T13:05:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000013', 'segment', 'Creative agency',
  '2025-11-14T10:30:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000012', 'segment', 'Health & wellness',
  '2025-11-22T13:30:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000013', 'primary_use_case', 'Portfolio showcase',
  '2025-11-15T10:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000016', 'segment', 'Consumer product startup',
  '2025-11-25T14:30:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000016', 'budget_sensitivity', 'High',
  '2025-11-25T16:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000014', 'segment', 'B2B SaaS startup',
  '2025-11-18T13:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000015', 'segment', 'Design studio',
  '2025-11-22T14:00:00.000Z'
);
INSERT INTO crm.customer_attributes (customer_id, attribute_name, attribute_value, last_updated) VALUES (
  '00000000-0000-0000-0001-000000000017', 'segment', 'Food & beverage',
  '2025-11-26T16:00:00.000Z'
);
INSERT INTO crm.issues (id, key, title, description, status, priority, rank, assignee, labels, customer_id, signal_id, insight_id, experiment_id, solution, based_on_signals, what_we_wont_do, how_we_know_it_works, ready_for_dev, needs_po, created_at, updated_at) VALUES (
  '00000000-0000-0000-0006-000000000001', 'ALI-1', 'finalize product and customer dashboard', NULL,
  'todo', 'p0', 1000,
  'Barend', '{}'::text[],
  NULL,
  NULL,
  NULL,
  NULL,
  NULL, NULL, NULL,
  NULL, false, false,
  '2025-12-15T07:12:01.293Z',
  '2025-12-15T21:02:23.664Z'
);
INSERT INTO crm.issues (id, key, title, description, status, priority, rank, assignee, labels, customer_id, signal_id, insight_id, experiment_id, solution, based_on_signals, what_we_wont_do, how_we_know_it_works, ready_for_dev, needs_po, created_at, updated_at) VALUES (
  '00000000-0000-0000-0006-000000000002', 'ALI-2', 'kopieer lucky flowchart framework naar roadmap en userflows', NULL,
  'backlog', 'p3', 1,
  'Lars', '{}'::text[],
  NULL,
  NULL,
  NULL,
  NULL,
  NULL, NULL, NULL,
  NULL, false, false,
  '2025-12-15T21:26:58.163Z',
  '2025-12-15T21:27:04.923Z'
);
INSERT INTO crm.blueprints (id, name, segment, one_liner, use_case, status, included_sections, customization_variables, proof_summary, outcomes, thumbnail_url, demo_url, internal_notes, owner, created_at, updated_at) VALUES (
  '00000000-0000-0000-0007-000000000001', 'Local Service Bookings + Reminders + Follow-up', 'local_service', 'Integrated booking system with automated reminders and post-service follow-up for local service providers',
  'For hairdressers, therapists, consultants, and service businesses needing reliable booking and customer engagement', 'active',
  '{"services","booking_calendar","pricing","testimonials","contact"}', '{"Business name and location","Service types and duration","Pricing per service","Booking questions","Reminder timing","Follow-up survey questions"}',
  'Used by 2 customers. 60% no-show reduction through reminders, 25% repeat booking increase.', '[{"notes":"SMS + email reminders 24h before","value":"-60%","metric":"No-show rate"},{"notes":"Post-service follow-up survey","value":"+25%","metric":"Repeat bookings"}]'::jsonb::jsonb,
  NULL, NULL, NULL, 'Barend',
  '2025-11-10T09:00:00.000Z',
  '2025-11-26T12:00:00.000Z'
);
INSERT INTO crm.blueprints (id, name, segment, one_liner, use_case, status, included_sections, customization_variables, proof_summary, outcomes, thumbnail_url, demo_url, internal_notes, owner, created_at, updated_at) VALUES (
  '00000000-0000-0000-0007-000000000002', 'Customer First-Case', 'b2b_startup', 'First customer delivery flow: take a lead from discovery to a live website + working lead workflow.',
  'Complete operational blueprint for delivering first customer engagements with Alive. Covers the entire journey from qualified lead through discovery, build, QA, go-live, and follow-up. Establishes reusable patterns for future customer implementations.', 'active',
  '{"Home","Services","About","Contact","Lead Form"}', '{"Customer company name","Brand colors/fonts","CTA messaging","Lead routing destination"}',
  'Tested with 3 first customers (Studio Flora, Pixel & Clay, GrowthLabs). Average time from qualified lead to live: 7 days. 100% form submission routing success.', '[{"notes":"From qualified lead to production","value":"7","metric":"Days to live"},{"notes":"No routing errors or manual fixes needed","value":"100%","metric":"Form success rate"},{"notes":"80% of first customers reuse this blueprint","value":"80%","metric":"Reuse rate"}]'::jsonb::jsonb,
  NULL, NULL, 'This blueprint is the foundation for all first-time customer engagements. Focus on clarity, speed, and capturing learnings for iteration. See User Flows tab for operational details.', 'Barend',
  '2025-11-15T10:00:00.000Z',
  '2025-11-27T14:30:00.000Z'
);
INSERT INTO crm.blueprints (id, name, segment, one_liner, use_case, status, included_sections, customization_variables, proof_summary, outcomes, thumbnail_url, demo_url, internal_notes, owner, created_at, updated_at) VALUES (
  '00000000-0000-0000-0007-000000000003', 'B2B Startup Lead Flow + CRM Sync', 'b2b_startup', 'Complete lead capture, qualification, and CRM synchronization for B2B SaaS products',
  'For early-stage B2B companies needing to capture, qualify, and nurture enterprise leads with automated follow-up', 'active',
  '{"hero","product_demo","pricing","case_studies","contact"}', '{"Company name and brand","Product features and benefits","Pricing tiers and CTAs","Lead qualification questions","Hubspot form mapping","Email sequences"}',
  'Used by 3 customers. 40% increase in qualified leads, 50% reduction in manual follow-up.', '[{"notes":"After form optimization","value":"+40%","metric":"Lead capture rate"},{"notes":"Automated workflows","value":"-50%","metric":"Manual follow-up time"}]'::jsonb::jsonb,
  NULL, NULL, NULL, 'Barend',
  '2025-11-15T10:00:00.000Z',
  '2025-11-27T15:30:00.000Z'
);
INSERT INTO crm.blueprints (id, name, segment, one_liner, use_case, status, included_sections, customization_variables, proof_summary, outcomes, thumbnail_url, demo_url, internal_notes, owner, created_at, updated_at) VALUES (
  '00000000-0000-0000-0007-000000000004', 'Portfolio + Project Inquiries + Qualification', 'portfolio', 'Beautiful portfolio gallery with project inquiry forms and automated qualification workflow',
  'For freelancers, design studios, and creative professionals showcasing work and generating qualified leads', 'active',
  '{"portfolio_gallery","about","services","inquiry_form","contact"}', '{"Portfolio projects and descriptions","Service offerings","Budget tiers","Project inquiry questions","Response email template","Portfolio image optimization"}',
  'Used by 5+ customers. 3x increase in qualified project inquiries.', '[{"notes":"Qualification questions reduce scope creep","value":"3x increase","metric":"Inquiry quality"},{"notes":"Automated acknowledgment emails","value":"-4 hours","metric":"Response time"}]'::jsonb::jsonb,
  NULL, NULL, NULL, 'Barend',
  '2025-11-05T14:30:00.000Z',
  '2025-11-25T09:45:00.000Z'
);
INSERT INTO crm.blueprints (id, name, segment, one_liner, use_case, status, included_sections, customization_variables, proof_summary, outcomes, thumbnail_url, demo_url, internal_notes, owner, created_at, updated_at) VALUES (
  '00000000-0000-0000-0007-000000000005', 'Portfolio + Project Inquiries + Qualification', 'portfolio', 'Beautiful portfolio gallery with project inquiry forms and automated qualification workflow',
  'For freelancers, design studios, and creative professionals showcasing work and generating qualified leads', 'active',
  '{"portfolio_gallery","about","services","inquiry_form","contact"}', '{"Portfolio projects and descriptions","Service offerings","Budget tiers","Project inquiry questions","Response email template","Portfolio image optimization"}',
  'Used by 5+ customers. 3x increase in qualified project inquiries.', '[{"notes":"Qualification questions reduce scope creep","value":"3x increase","metric":"Inquiry quality"},{"notes":"Automated acknowledgment emails","value":"-4 hours","metric":"Response time"}]'::jsonb::jsonb,
  NULL, NULL, NULL, 'Barend',
  '2025-11-05T14:30:00.000Z',
  '2025-11-25T09:45:00.000Z'
);
INSERT INTO crm.blueprints (id, name, segment, one_liner, use_case, status, included_sections, customization_variables, proof_summary, outcomes, thumbnail_url, demo_url, internal_notes, owner, created_at, updated_at) VALUES (
  '00000000-0000-0000-0007-000000000006', 'Local Service Bookings + Reminders + Follow-up', 'local_service', 'Integrated booking system with automated reminders and post-service follow-up for local service providers',
  'For hairdressers, therapists, consultants, and service businesses needing reliable booking and customer engagement', 'active',
  '{"services","booking_calendar","pricing","testimonials","contact"}', '{"Business name and location","Service types and duration","Pricing per service","Booking questions","Reminder timing","Follow-up survey questions"}',
  'Used by 2 customers. 60% no-show reduction through reminders, 25% repeat booking increase.', '[{"notes":"SMS + email reminders 24h before","value":"-60%","metric":"No-show rate"},{"notes":"Post-service follow-up survey","value":"+25%","metric":"Repeat bookings"}]'::jsonb::jsonb,
  NULL, NULL, NULL, 'Barend',
  '2025-11-10T09:00:00.000Z',
  '2025-11-26T12:00:00.000Z'
);
INSERT INTO crm.blueprints (id, name, segment, one_liner, use_case, status, included_sections, customization_variables, proof_summary, outcomes, thumbnail_url, demo_url, internal_notes, owner, created_at, updated_at) VALUES (
  '00000000-0000-0000-0007-000000000007', 'B2B Startup Lead Flow + CRM Sync', 'b2b_startup', 'Complete lead capture, qualification, and CRM synchronization for B2B SaaS products',
  'For early-stage B2B companies needing to capture, qualify, and nurture enterprise leads with automated follow-up', 'active',
  '{"hero","product_demo","pricing","case_studies","contact"}', '{"Company name and brand","Product features and benefits","Pricing tiers and CTAs","Lead qualification questions","Hubspot form mapping","Email sequences"}',
  'Used by 3 customers. 40% increase in qualified leads, 50% reduction in manual follow-up.', '[{"notes":"After form optimization","value":"+40%","metric":"Lead capture rate"},{"notes":"Automated workflows","value":"-50%","metric":"Manual follow-up time"}]'::jsonb::jsonb,
  NULL, NULL, NULL, 'Barend',
  '2025-11-15T10:00:00.000Z',
  '2025-11-27T15:30:00.000Z'
);
INSERT INTO crm.blueprints (id, name, segment, one_liner, use_case, status, included_sections, customization_variables, proof_summary, outcomes, thumbnail_url, demo_url, internal_notes, owner, created_at, updated_at) VALUES (
  '00000000-0000-0000-0007-000000000008', 'Customer First-Case', 'b2b_startup', 'First customer delivery flow: take a lead from discovery to a live website + working lead workflow.',
  'Complete operational blueprint for delivering first customer engagements with Alive. Covers the entire journey from qualified lead through discovery, build, QA, go-live, and follow-up. Establishes reusable patterns for future customer implementations.', 'active',
  '{"Home","Services","About","Contact","Lead Form"}', '{"Customer company name","Brand colors/fonts","CTA messaging","Lead routing destination"}',
  'Tested with 3 first customers (Studio Flora, Pixel & Clay, GrowthLabs). Average time from qualified lead to live: 7 days. 100% form submission routing success.', '[{"notes":"From qualified lead to production","value":"7","metric":"Days to live"},{"notes":"No routing errors or manual fixes needed","value":"100%","metric":"Form success rate"},{"notes":"80% of first customers reuse this blueprint","value":"80%","metric":"Reuse rate"}]'::jsonb::jsonb,
  NULL, NULL, 'This blueprint is the foundation for all first-time customer engagements. Focus on clarity, speed, and capturing learnings for iteration. See User Flows tab for operational details.', 'Barend',
  '2025-11-15T10:00:00.000Z',
  '2025-11-27T14:30:00.000Z'
);
