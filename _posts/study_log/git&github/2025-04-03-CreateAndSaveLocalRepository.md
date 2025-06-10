---
title: (git)2. 저장소 생성 및 저장(local)
post_order: 2
thumbnail: https://velog.velcdn.com/images%2Fhaneul7960%2Fpost%2Fa990fb96-f709-406d-8b01-5dc7ce4a7466%2Fimage.png
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
excerpt: 로컬 저장소를 git 폴더로 지정 혹은 git clone
project_rank: "680"
sticker: emoji//1f4aa
---

# 일반적인 순서

- `git init` | `git clone` → (`git remote` )→ (`git pull`) → `git add` → (`git merge`)→ `git commit` → `git push`

# repository(저장소) 생성

1. 아직 버전관리를 하지 않는 로컬 디렉토리 하나를 선택해서 Git 저장소를 적용하는 방법
2. 다른 어딘가에서 Git 저장소를 Clone 하는 방법

## 1. 기존 디렉토리를 Git 저장소로 만들기

- `git init`
    - **원하는 디렉토리로 이동** 후 git init 실행
    - .git이라는 하위 디렉토리 생성
    - git을 **사용할 준비**를 하는 상태
    - 어떤 파일도 **관리하지 않는 상태**
- `git add`와 `git commit`을 통해 저장소 기록

```bash
$ git add <file1> <file2> ...
$ git add .
$ git commit -m '<commit_massage>'
```

## 2. 기존 저장소 Clone

![출처: https://velog.io/@itzel_02/IntelliJ-git-clone-및-연동-방법](/assets/images/study_log/git&github/2025-04-03-CreateAndSaveLocalRepository/image01.png)


```bash
$ git clone <url>
$ git clone <url> <rename_repository>

ex)
$ git clone https://github.com/libgit2/libgit2 mylibgit
```

- `git clone` : remote repository(GitHub) → local repository
- <url> 뒤에 직접 저장소 이름을 적을 수 있으며, 생략할 시 remote repository와 동일하게 설정됨

# 수정 및 저장소 저장

## 파일 상태 확인

![파일의 라이프사이클](/assets/images/study_log/git&github/2025-04-03-CreateAndSaveLocalRepository/image02.png)

파일의 라이프사이클

- `git status`: **Untracked, Unmodified, Modified, Staged** 등의 파일 상태 정보

```bash
$ git status -s
M README
MM Rakefile
A lib/git.rb
M lib/simplegit.rb
?? LICENSE.txt
```

- `git status -s` | `git status --short`
    
    
    | 기호 | 의미 |
    | --- | --- |
    | **M** | **파일이 수정됨 (스테이징되지 않음)** |
    | MM | 파일이 수정됨 (스테이징 전과 후 두 번 수정됨) |
    | **A** | **새 파일이 추가됨 (스테이징됨)** |
    | **??** | **추적되지 않은 파일 (Git이 관리하지 않는 새 파일)** |
    | D | 파일이 삭제됨 (Git이 추적 중이던 파일이 삭제됨) |
    | AM | 새로 추가한 파일(`A`), 이후 수정됨(`M`) |
    | AD | 새로 추가한 파일(`A`), 이후 삭제됨(`D`) |
    | R | 파일이 이동(리네임)됨 |
    | C | 파일이 복사됨 |
    | **UU** | **병합 충돌이 발생한 파일** |

## 파일을 새로 추적하기

- `git add <file1> <file2> ...` | `git add .` | `git add *`
    - staged 상태로 변환하려는 file 추가
    - **. or *** : .gitignore를 제외한 디렉토리 내 모든 파일
- Changes to be committed, 즉 **commit할 준비가 된 상태(Index)**로 변환

```bash
$ git add README.md
$ git status
On branch master
Your branch is up-to-date with 'origin/master'.
Changes to be committed:
(use "git reset HEAD <file>..." to unstage)
new file: README.md
```

## Modified → Stage&commit 하기

![git_lifecycle](/assets/images/study_log/git&github/2025-04-03-CreateAndSaveLocalRepository/image03.png)

- 위의 그림과 같이 한번 add된 파일이라도 commit 이후에는 Stage 상태가 아니게 됨
- 파일이 변경되었다면 **add** 후 **commit**을 실행, 즉 **commit전에 항상 add한다**고 생각
- `git add .` → `git commit -m "<commit_massage>"`
    - 파일 **버전 생성** 및 해당 **버전 설명(메세지)** 생성
- `git commit -a -m "<commit_massage>"`
    - **git add와 commit을 동시에 실행**
    - 단 이 방법으로 **Untracked(새롭게 생성된 파일 등)**의 경우 **git add 불가능**

```bash
$ git commit -m "Story 182: Fix benchmarks for speed"
[master 463dc4f] Story 182: Fix benchmarks for speed
2 files changed, 2 insertions(+)
create mode 100644 README
```

- commit 정보
    - master : **commit branch**
    - 463dc4f : **체크섬**

## 파일 삭제

- `git rm <file>` : **Staging → Modified**, **파일 삭제**
- `git rm --cached <file>` : **Staging → Untracked**, **파일 유지**

# .gitignore

![image](/assets/images/study_log/git&github/2025-04-03-CreateAndSaveLocalRepository/image04.png)

![image](/assets/images/study_log/git&github/2025-04-03-CreateAndSaveLocalRepository/image05.png)

- git add . 을 실행하면 디렉토리에 있는 쓸데없는 파일까지 추가가 됨
- git add를 편하게 수행하기 위해 **git 예외 파일**을 기록
- **.gitignore 파일 생성** 후 **예외 리스트를 작성**
- 작성 방식
    - **Glob 패턴의 정규표현식**
    - **#주석**
    - **/로 시작** 시 **하위 디렉토리 적용되지(Recursivity) 않음**
    - **!로 시작**하는 패턴의 파일 **무시하지 않음**
- VSCode상에서 **연한 글씨로 표시**된다면 gitignore가 적용된 상태
- gitignore 예시
    - https://github.com/github/gitignore ~~(ROS도 있음 ㅋㅋ)~~