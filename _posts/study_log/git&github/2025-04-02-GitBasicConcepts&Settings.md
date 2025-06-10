---
title: (git)1. 기본 개념 & 설정
thumbnail: https://images.datacamp.com/image/upload/v1651047046/image8_0e61d0dad8.png
layout: post
author: jhj
categories:
  - StudyLog
  - Git&GitHub
tags:
  - Git
  - GitHub
  - commit
  - config
excerpt: git 작동 방식 및 설정
project_rank: "680"
sticker: emoji//1f4aa
---

# 참고자료

- https://git-scm.com/book/ko/v2

# Git & GitHub 편집 Tool

## **CLI (Command Line Interface)**

**특징**

- Git의 모든 기능을 사용할 수 있는 가장 강력한 도구
- 스크립트 자동화 가능
- 리소스를 적게 사용하고 빠름

**장점**

✅ 모든 Git 명령어 사용 가능

✅ 빠르고 유연함

✅ 에러 메시지와 로그 확인이 쉬움

✅ 다양한 상황에 대한 문제 해결 가능

**단점**

❌ 명령어 암기가 필요함

❌ 입문자에게 진입 장벽이 높음

❌ 시각화가 부족함

### **VSCode (Visual Studio Code Git Extension)**

**특징**

- 내장 Git 지원
- 시각적 인터페이스 제공
- 파일 수정과 커밋을 동시에 가능

**장점**

✅ 커밋, 브랜치, 병합 등의 작업이 GUI로 가능

✅ 변경사항을 시각적으로 확인 가능

✅ 확장 기능(GitLens 등)으로 기능 확장 가능

✅ 코드 편집과 Git 작업을 한 곳에서 처리

**단점**

❌ 일부 고급 Git 기능은 여전히 CLI 필요

❌ 복잡한 충돌 상황에서는 처리 어려움

❌ 확장 기능이 무겁거나 충돌할 수 있음

### **GitHub GUI (GitHub Desktop 등)**

**특징**

- GitHub 공식 데스크탑 클라이언트
- 시각적인 브랜치 흐름과 변경사항 확인 가능
- GitHub와 연동에 최적화

**장점**

✅ 직관적인 사용자 인터페이스

✅ 간단한 커밋, 푸시, 풀 요청(PR) 생성에 적합

✅ 협업에 용이 (GitHub flow 지원)

✅ GitHub 저장소와의 통합이 쉬움

**단점**

❌ GitHub 이외의 Git 서버 연동은 제한적

❌ 고급 기능이나 복잡한 Git 작업은 불가

❌ CLI 대비 유연성 부족

- 난 CLI밖에 모르니 기본 개념만 참고하3

# VCS(**Version Control System)**

![중앙집중식 버전 관리(CVCS)](/assets/images/study_log/git&github/2025-04-02-GitBasicConcepts&Settings/image01.png)

중앙집중식 버전 관리(CVCS)

![분산 버전 관리 시스템(DVCS)](/assets/images/study_log/git&github/2025-04-02-GitBasicConcepts&Settings/image02.png)

분산 버전 관리 시스템(DVCS)

- 파일 변화를 시간에 따라 기록, 이동 할 수 있는 기능
- 이 때 기록한 상태를 버전이라고 함
- 즉 뭔가 잘못 되었을 때 기존 파일로 되돌리기가 가능하다.

# Git의 특징

## 스냅샷

![image.png](/assets/images/study_log/git&github/2025-04-02-GitBasicConcepts&Settings/image03.png)

- Git의 버전관리 방식
- **변경사항이 없는 파일**의 경우 데이터를 저장하지 않고 **이전 상태의 파일 링크**만 저장
- git과 다른 VSC와의 차이점~~(이라고 쓰여있다)~~

## 거의 모든 명령을 로컬에서 실행

- 서버 조회 없이 로컬에서 처리
- 실행속도 빠름

## 무결성

```text
24b9da6552252987aa493b52f8696cd6d3b00373
```

- 데이터를 저장하기 전에 40자 길이의 16진수 문자열인 **체크섬**(**해시)**을 생성
- 버전과 1대1  대응 → 추적 용이

# 파일상태

![파일의 라이프사이클](/assets/images/study_log/git&github/2025-04-02-GitBasicConcepts&Settings/image04.png)

파일의 라이프사이클

- 기본적인 흐름은 다음과 같다
- 파일 수정 → 스냅샷에 추가(add) → 저장소에 기록(commit)
- **Untracked** : Git의 스냅샷에 추가되지 않은 모든 파일
- **Unmodifed** : 저장소에 기록된 파일 중 변경사항이 없는 파일
    - `git commit` 상태
- **Modified** : 저장된 파일 중 변경사항이 저장소에 반영되지 않은 상태
- **Staged** : git commit을 통해 저장소에 기록이 가능한 상태
    - `git add` 상태
    - **Index(Staging Area)** 상태

## Tree

![image.png](/assets/images/study_log/git&github/2025-04-02-GitBasicConcepts&Settings/image05.png)

| 트리 | 역할 |
| --- | --- |
| HEAD | 마지막 커밋 스냅샷, 다음 커밋의 부모 커밋 |
| Index | 다음에 커밋할 스냅샷 |
| working directory | 샌드박스 |

- **HEAD** : 현재 branch의 마지막 commit
- **Index**
    - 바로 다음에 커밋할 것들
    - **Staging Area :** `git commit` 실행 시 Git이 처리할 것들이 있는 곳
- **working directory** : 실제 파일, commit 전 **변경 가능한 상태**

# Git 설정

## git config

- Git 관련 환경 설정 내용
- **/etc/gitconfig** :
    - `git config --system` 을 통해 변경 가능, 관리자 권한 필요
    - 시스템의 모든 사용자와 모든 저장소에 적용되는 설정
- **~/.gitconfig, ~/.config/git/config**
    - 특정 사용자(즉 현재 사용자)에게만 적용되는 설정
    - `git config --global`
- **.git/config**
    - Git 디렉토리에 있고 특정 저장소(혹은 현재 작업 중인 프로젝트)에만 적용
    - global설정보다 **우선순위 높음**
    - `git config`, `git config --local`

## 사용자 정보

```bash
$ git config --global user.name "<name>"
$ git config --global user.email <email>
```

![화면 캡처 2025-04-04 132850.png](/assets/images/study_log/git&github/2025-04-02-GitBasicConcepts&Settings/image06.png)

- **name**
    - 사용자 이름. commit 작성자 확인에 사용
    - 일반적으로 github 아이디와 동일하게 설정하지만 같을 필요는 없음
- **email** : 이메일
- **주의사항** : —global설정과 .git(로컬설정) 중 **로컬 설정 우선순위가 높다**

```bash
$ git config user.name
John Doe

$ git config --list
user.name=John Doe
user.email=johndoe@example.com
color.status=auto
color.branch=auto
color.interactive=auto
color.diff=auto
...
```

- `git config <key>`, `git config --lsit` : 설정 내용 확인

## 도움말 보기

```bash
$ git help <verb>
$ man git-<verb>
```

- 해당 메뉴얼 확인 ex) git help config

```bash
$ git add -h
usage: git add [<options>] [--] <pathspec>...
-n, --dry-run dry run
-v, --verbose be verbose
-i, --interactive interactive picking
-p, --patch select hunks interactively
-e, --edit edit current diff and apply
-f, --force allow adding otherwise ignored files
-u, --update update tracked files
-N, --intent-to-add record only the fact that the path will be added
later
-A, --all add changes from all tracked and untracked files
--ignore-removal ignore paths removed in the working tree (same
as --no-all)
--refresh don't add, only refresh the index
--ignore-errors just skip files which cannot be added because of
errors
--ignore-missing check if - even missing - files are ignored in
dry run
--chmod <(+/-)x> override the executable bit of the listed files
```

- `-h` , `--help` 옵션 활용

## Git Alias

- 기존 명령어를 **사용자 설정 명령어(단축키)**로 생성
- `git config --global alias.<self_command> <command>`

```bash
$ git config --global alias.co checkout
$ git config --global alias.br branch
$ git config --global alias.ci commit
$ git config --global alias.st status

이 예시에서 아래 두 명령은 동일한 명령임
$ git co
$ git checkout
```