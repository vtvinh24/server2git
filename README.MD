# Hackathon Platform

A platform to manage hackathons with support for participants, judges, mentors, and hosts. The system automates event, track, problem, team, and submission management, and integrates deeply with GitHub for code and container workflows.

## Features

### 1. Registration

- **Participants**: Register to join events and submit solutions.
- **Judges**: Register to evaluate submissions.
- **Mentors**: Register to support teams or participants.
- **Hosts**: Register to organize and manage events.

### 2. Events & Tracks Management

- **Hosts** can create and manage events.
- Each event can have multiple custom tracks.
- Team management mode (host-defined or participant-created) is exclusive and set as an event option during creation.

### 3. Problems Management

- **Hosts** can create problems with:
  - Title
  - Statement
  - Source code (optional)
- Creating a problem automatically generates a private "master" repository in a configured GitHub organization using a GitHub App:
  - Repo name = problem title
  - README = problem statement
  - Source code (if any) included
  - Contains a `Dockerfile`, `source/` folder, and `scripts/` folder

### 4. Team Management

- Team management mode is exclusive per event (either host-defined or participant-created).
- Mentors are assigned to teams manually by hosts, can be requested by teams, or distributed automatically by the system (configurable per event, updatable before competition stage).

### 5. Submissions Management

- **Participants** submit solutions via GitHub repository only (no direct file upload currently).
- No restriction on the number of submissions per team/participant.
- **Hosts** can view and manage all submissions.
- **Mentors** can view submissions from their assigned teams.

### 6. Problem Package Structure

- Each problem package contains:
  - `Dockerfile`: Used to build the container image (not visible to participants).
  - `source/`: Base source code for participants (participants only access files here; their repos are created with the content of this folder).
  - `scripts/`: Scripts used by the container image (not visible to participants).
  - `workflows/evaluate.yml`: Workflow file for automated evaluation (added to participant repos).

### 7. GitHub & Container Integration

- The master repo contains a `Dockerfile` and a GitHub Actions workflow (`publish.yml`) to build and push the image to GHCR.
- Participants/teams can authorize the GitHub App per repo (OAuth flow, preferably same app, but can be separate).
- The server commits a workflow file to participant repos to automatically pull the image, run code, and score against public test cases and evaluation scripts.

### 8. Event/Track Customization

- Tracks can be customized with time limits, allowed languages, and other options (e.g., support for multi-file projects, libraries, etc.).

### 9. Judging & Evaluation

- Supports manual, automated, and hybrid judging (e.g., automated with human review, or deployed for human judging).
- Some evaluation scripts and test cases can be private (for final scoring), others public.
- Only hosts can define evaluation scripts.

---

## Core Workflow (Current Focus)

1. **Host creates a problem**
   - System generates a private master repo with problem package structure.
2. **Participant submits a solution**
   - System creates a repo for the participant/team with only the `source/` folder and a workflow file.
3. **System automates repo lifecycle**
   - Uses GitHub Actions and GitHub App for evaluation and management.

---

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure GitHub App and organization in `config/`
4. Start the server: `npm start`

---

For setup details, see [SETUP_GUIDE.MD](./SETUP_GUIDE.MD).
