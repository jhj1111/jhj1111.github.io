---
layout: post
title: "저장소 생성 및 저장(remote)"
description: >
  GitHub 저장소 생성 및 데이터 업데이트
sitemap: false
hide_last_modified: true
categories: studylog
tags: git&github
---

# 저장소 생성 및 저장(remote)

# GitHub(remote) repository 생성

![화면 캡처 2025-04-04 153301](/assets/img/2025-04-05-CreateAndSaveRemoteRepository/image01.png)

- 회원 가입 및 로그인 후
- 새로운 저장소 생성(**New repository**)

![image](/assets/img/2025-04-05-CreateAndSaveRemoteRepository/image02.png)

- **Repository name** : 저장소 이름 설정
- **Description** : 저장소의 간단한 설명
- README : README.md(저장소 설명 markdown 파일) 생성이 가능하나 로컬과의 연동이 귀찮아지므로 비추천

# remote(GitHub) - local repository 연결

![화면 캡처 2025-04-04 154358](/assets/img/2025-04-05-CreateAndSaveRemoteRepository/image03.png)

1. follow line by line
- `git init`
    - 해당 디렉토리를 git 저장소로 선언
- `git branch -M main`
    - 기본 저장소를 main으로 변경
    - **GitHub**의 기본 저장소 == **main**
    - **Git**의 기본 저장소 == **master**
    - 따라서 branch이름을 통일시키는 작업이 필요함
    - master가 부정적인 의미라나 뭐라나,,,
- `git push -u orign main`
    - **push 경로 설정 - origin(remote repository)**의 **main branch**
    - 처음 한번 설정 이후 `git push`
1. git clone
- `git clone <url>`  → `git add` → `git commit` → `git push`

# remote

## 리모트 저장소 확인

```bash
$ git remote
origin
$ git remote add pb https://github.com/paulboone/ticgit
$ git remote -v
origin https://github.com/schacon/ticgit (fetch)
origin https://github.com/schacon/ticgit (push)
pb https://github.com/paulboone/ticgit (fetch)
pb https://github.com/paulboone/ticgit (push)
```

## 리모트 저장소 추가

- `git remote add [단축이름] <url>`
    - [단축이름] 생략 시 **origin**으로 생성
    - 단일 remote를 가질 시 보통 이름 지정 과정을 생략하나
    - 다수의 remote 저장소를 가질 시 이름을 지정 해주는 것이 좋음

## 리모트 저장소 이름 변경 및 삭제

- `git remote rename <pre_name> <new_name>` : remote 저장소 이름 변경
- `git remote remove <remote_name>` | `git remote rm <remote_name>` : remote 저장소 삭제

# Fetch & Pull

- **remote의 변경 사항**을 **로컬로** 가져오는 작업
- `git pull` == `git fetch` && `git merge` | `git rebase`

## Fetch

![image](/assets/img/2025-04-05-CreateAndSaveRemoteRepository/image04.png)

![image](/assets/img/2025-04-05-CreateAndSaveRemoteRepository/image05.png)

![fetch branch 확인](/assets/img/2025-04-05-CreateAndSaveRemoteRepository/image06.png)

fetch branch 확인

![변경사항 확인](/assets/img/2025-04-05-CreateAndSaveRemoteRepository/image07.png)

변경사항 확인

- `git fetch [remote]` 실행 시 로컬 데이터 변경되지 않음
    - 대신 새로운 branch를 생성
    - 변경 내용 확인
- `git merge` : 로컬 저장소에 변경 사항 적용(**branch 통합** 개념)
- `git branch --remote -d origin/main` : fetch로 가져온 **origin/main** branch 삭제

## Pull

- remote 저장소의 변경 사항을 **바로 로컬에 적용**
- remote와 로컬 저장소와 충돌 발생 시 충돌 문제를 해결해야 pull 가능

# Push

- `git push [리모트 저장소 이름] [브랜치 이름]`
- fetch | pull과 마찬가지로 **충돌 발생 시 push가 불가능**