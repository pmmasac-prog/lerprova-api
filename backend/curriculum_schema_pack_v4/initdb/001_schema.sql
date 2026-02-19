BEGIN;

CREATE TABLE IF NOT EXISTS curriculum_subjects (
  id            INT PRIMARY KEY,
  code          VARCHAR(50),
  name          VARCHAR(120) NOT NULL,
  area          VARCHAR(100),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_subjects_name
  ON curriculum_subjects(LOWER(name));

CREATE TABLE IF NOT EXISTS curriculum_units (
  id            INT PRIMARY KEY,
  subject_id    INT NOT NULL REFERENCES curriculum_subjects(id) ON DELETE CASCADE,
  grade         VARCHAR(10) NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  order_index   INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_units_subject_grade
  ON curriculum_units(subject_id, grade);

CREATE TABLE IF NOT EXISTS curriculum_topics (
  id              INT PRIMARY KEY,
  unit_id         INT NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
  order_index     INT NOT NULL DEFAULT 1,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  default_lessons SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topics_unit
  ON curriculum_topics(unit_id);

CREATE TABLE IF NOT EXISTS curriculum_competencies (
  id            INT PRIMARY KEY,
  code          VARCHAR(50),
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  area          VARCHAR(100),
  subject_id    INT REFERENCES curriculum_subjects(id) ON DELETE SET NULL,
  grade         VARCHAR(10),
  source        VARCHAR(100),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curriculum_skills (
  id            INT PRIMARY KEY,
  code          VARCHAR(50),
  title         VARCHAR(255),
  description   TEXT NOT NULL,
  area          VARCHAR(100),
  subject_id    INT REFERENCES curriculum_subjects(id) ON DELETE SET NULL,
  grade         VARCHAR(10),
  difficulty    SMALLINT,
  tags          TEXT,
  source        VARCHAR(100),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_skill_code
  ON curriculum_skills(code)
  WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS curriculum_topic_skills (
  topic_id   INT NOT NULL REFERENCES curriculum_topics(id) ON DELETE CASCADE,
  skill_id   INT NOT NULL REFERENCES curriculum_skills(id) ON DELETE CASCADE,
  priority   SMALLINT NOT NULL DEFAULT 3,
  note       TEXT,
  PRIMARY KEY(topic_id, skill_id)
);

CREATE TABLE IF NOT EXISTS curriculum_skill_competencies (
  skill_id       INT NOT NULL REFERENCES curriculum_skills(id) ON DELETE CASCADE,
  competency_id  INT NOT NULL REFERENCES curriculum_competencies(id) ON DELETE CASCADE,
  PRIMARY KEY(skill_id, competency_id)
);

CREATE TABLE IF NOT EXISTS curriculum_methodologies (
  id            INT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  description   TEXT,
  modality      VARCHAR(50),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meth_name
  ON curriculum_methodologies(LOWER(name));

CREATE TABLE IF NOT EXISTS curriculum_resources (
  id            INT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  type          VARCHAR(50),
  description   TEXT,
  url           TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curriculum_topic_methodologies (
  topic_id         INT NOT NULL REFERENCES curriculum_topics(id) ON DELETE CASCADE,
  methodology_id   INT NOT NULL REFERENCES curriculum_methodologies(id) ON DELETE CASCADE,
  strength         SMALLINT NOT NULL DEFAULT 3,
  note             TEXT,
  PRIMARY KEY(topic_id, methodology_id)
);

CREATE TABLE IF NOT EXISTS curriculum_topic_resources (
  topic_id       INT NOT NULL REFERENCES curriculum_topics(id) ON DELETE CASCADE,
  resource_id    INT NOT NULL REFERENCES curriculum_resources(id) ON DELETE CASCADE,
  strength       SMALLINT NOT NULL DEFAULT 3,
  note           TEXT,
  PRIMARY KEY(topic_id, resource_id)
);

COMMIT;
