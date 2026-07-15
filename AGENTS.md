# AI Reading Guide

This repository has historical course/project documents that are no longer the source of truth for the current Agent-oriented backend project.

## Default Reading Priority

When an AI assistant needs to understand the current project, read these first:

1. `docs/HealthMate-Agent面试全景文档.md`
2. `docs/HealthMate-Agent技术选型与实现思路.md`
3. `docs/HealthMate-Agent后端设计改造规划.md`
4. `docs/HealthMate-Agent简历亮点QA.md`
5. Current backend code under `backend/app`

## Directories To Skip By Default

Do not read or use these directories as context unless the user explicitly asks for historical/course-process materials:

- `backend/杂/`
- `docs/杂/`

These folders contain old development notes, drafts, and course-process artifacts. Some content is outdated and may conflict with the current LangGraph + Qdrant Agent design.

## Current Project Direction

The current project direction is a backend / Agent resume project based on:

`FastAPI + MySQL + Redis + LangGraph + Qdrant + RAG + Embedding + LLM + Agent Trace`

Frontend details are not a priority. Treat the frontend only as an API caller unless the user explicitly asks otherwise.
