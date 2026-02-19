BEGIN;
SET client_encoding = 'UTF8';

TRUNCATE TABLE curriculum_topic_resources RESTART IDENTITY CASCADE;
TRUNCATE TABLE curriculum_topic_methodologies RESTART IDENTITY CASCADE;
TRUNCATE TABLE curriculum_skill_competencies RESTART IDENTITY CASCADE;
TRUNCATE TABLE curriculum_topic_skills RESTART IDENTITY CASCADE;
TRUNCATE TABLE curriculum_resources RESTART IDENTITY CASCADE;
TRUNCATE TABLE curriculum_methodologies RESTART IDENTITY CASCADE;
TRUNCATE TABLE curriculum_skills RESTART IDENTITY CASCADE;
TRUNCATE TABLE curriculum_competencies RESTART IDENTITY CASCADE;
TRUNCATE TABLE curriculum_topics RESTART IDENTITY CASCADE;
TRUNCATE TABLE curriculum_units RESTART IDENTITY CASCADE;
TRUNCATE TABLE curriculum_subjects RESTART IDENTITY CASCADE;

COPY curriculum_subjects (id, code, name, area)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_subjects.csv'
WITH (FORMAT csv, HEADER true);

COPY curriculum_units (id, subject_id, grade, title)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_units.csv'
WITH (FORMAT csv, HEADER true);

COPY curriculum_topics (id, unit_id, order_index, title, default_lessons)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_topics.csv'
WITH (FORMAT csv, HEADER true);

COPY curriculum_competencies (id, code, title, description, area, subject_id, grade, source, active)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_competencies.csv'
WITH (FORMAT csv, HEADER true);

COPY curriculum_skills (id, code, title, description, area, subject_id, grade, difficulty, tags, source, active)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_skills.csv'
WITH (FORMAT csv, HEADER true);

COPY curriculum_methodologies (id, name, description, modality, active)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_methodologies.csv'
WITH (FORMAT csv, HEADER true);

COPY curriculum_resources (id, name, type, description, url, active)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_resources.csv'
WITH (FORMAT csv, HEADER true);

COPY curriculum_topic_skills (topic_id, skill_id, priority, note)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_topic_skills.csv'
WITH (FORMAT csv, HEADER true);

COPY curriculum_skill_competencies (skill_id, competency_id)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_skill_competencies.csv'
WITH (FORMAT csv, HEADER true);

COPY curriculum_topic_methodologies (topic_id, methodology_id, strength, note)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_topic_methodologies.csv'
WITH (FORMAT csv, HEADER true);

COPY curriculum_topic_resources (topic_id, resource_id, strength, note)
FROM '/docker-entrypoint-initdb.d/csv/curriculum_topic_resources.csv'
WITH (FORMAT csv, HEADER true);

COMMIT;
