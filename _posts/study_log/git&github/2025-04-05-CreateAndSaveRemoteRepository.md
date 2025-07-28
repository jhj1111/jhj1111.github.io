---
title: (git)4. 저장소 생성 및 저장(remote)
post_order: 4
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
excerpt: 원격(github) - 로컬 저장소 연결 및 관리
project_rank: "680"
sticker: emoji//1f4aa
---

# GitHub(remote) repository 생성

![화면 캡처 2025-04-04 153301](/assets/images/study_log/git&github/2025-04-05-CreateAndSaveRemoteRepository/image01.png)

- 회원 가입 및 로그인 후
- 새로운 저장소 생성(**New repository**)

![image](/assets/images/study_log/git&github/2025-04-05-CreateAndSaveRemoteRepository/image02.png)

- **Repository name** : 저장소 이름 설정
- **Description** : 저장소의 간단한 설명
- README : README.md(저장소 설명 markdown 파일) 생성이 가능하나 로컬과의 연동이 귀찮아지므로 비추천

# remote(GitHub) - local repository 연결

![화면 캡처 2025-04-04 154358](/assets/images/study_log/git&github/2025-04-05-CreateAndSaveRemoteRepository/image03.png)

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
    - **push 경로** 설정 - **origin(remote repository)** 의 **main branch**
    - 처음 한번 설정 이후 `git push`
1. git clone
- `git clone <url>`  → `git add` → `git commit` → `git push`

# remote

## 리모트 저장소 확인

- `git remote` : 등록된 remote **저장소의 단축 이름**
- `git remote -v` 
	- 단축 이름
	- URL
	- **upstream branch** : 
	  `git fetch`, `git pull`, `git push` 명령어가 기본적으로 따라가는 **<remote\>/<branch\>** 를 의미
- `git remote show <remote>` : remote 저장소의 구체적인 정보

```bash
$  git remote
origin

$  git remote add pb https://github.com/paulboone/ticgit
$  git remote -v
origin https://github.com/schacon/ticgit (fetch)
origin https://github.com/schacon/ticgit (push)
pb https://github.com/paulboone/ticgit (fetch)
pb https://github.com/paulboone/ticgit (push)

$  git remote show origin
* remote origin
  Fetch URL: https://github.com/schacon/ticgit
  Push URL: https://github.com/schacon/ticgit
  HEAD branch: master
  Remote branches:
    master								 tracked
    dev-branch 							 tracked
  Local branch configured for 'git pull':
    master merges with remote master
  Local ref configured for 'git push':
    master pushes to master (up to date)
```

## 리모트 저장소 추가

- `git remote add (단축이름) <url>`
    - (단축이름) 생략 시 **origin**으로 생성
    - 단일 remote를 가질 시 보통 이름 지정 과정을 생략하나
    - 다수의 remote 저장소를 가질 시 이름을 지정 해주는 것이 좋음

## 리모트 저장소 이름 변경 및 삭제

- `git remote rename <pre_name> <new_name>` : remote 저장소 이름 변경
- `git remote remove <remote_name>` \| `git remote rm <remote_name>` : 
  remote 저장소 삭제

## 리모트 브랜치
> remote branch도 로컬과 마찬가지로 브랜치를 가리키는 포인터를 생성하는 과정으로 이해할 수 있다.
 다만 로컬과 달리 실시간 branch 정보를 파악할 수 없으므로, 여러가지 설정이 필요하다.
 
![](/assets/images/study_log/git&github/2025-04-05-CreateAndSaveRemoteRepository/remote_branch.png)

### 리모트 트래킹 브랜치
> 로컬 저장소에 캐시된 remote branch.
 **remote branch 내용**을 담고 있으나 **수정이 불가**하며, 로컬 저장소에 변경사항을 저장(merge) 전 **변경내용을 확인하는 용도**로 사용된다.

- `git clone ` : [(git)2. 저장소 생성 및 저장(local)](../../../2025/04/03/CreateAndSaveLocalRepository.html)
- `<remote>/<branch>`
- 새로운 branch 생성 -> remote tranking branch 생성
	- `git checkout -t <remote_tracking_branch>`
	- `git checkout <new_local_branch>` : 가장 간단, 많이 사용
	- `git checkout -b <new_local_branch> <remote_tracking_branch>`
	- 이때 새로 만들어진 branch는 **<remote\>/<branch\>** 가 아닌 **<new_local_branch\>**

```bash
$ git checkout -b serverfix origin/serverfix
$ git checkout -t <remote_tracking_branch>
$ git checkout <new_local_branch>


Branch serverfix set up to track remote branch serverfix from origin.
Switched to a new branch 'serverfix'
```

`git branch -vv` : 추적 브랜치 설정 확인

```bash
$  git branch -vv
	iss53 7e424c3 [origin/iss53: ahead 2] forgot the brackets
	master 1ae2a45 [origin/master] deploying index fix
* serverfix f8674d9 [teamone/server-fix-good: ahead 3, behind 1] this
should do it
	testing 5ea463a trying something new
```

### 리모트 브랜치 생성&삭제
- `git push <remote> <branch>` : remote의 branch로 push
	- remote에 해당 branch가 없을 경우 새로 생성해서 push할 뿐, 일반 push와 동일
- `git push <remote> <local_branch>:<new_name>` : remote branch의 이름을 다르게 설정
	- 굳이 할 필요는 없어보인다. 참고만하자.

```bash
$  git fetch origin
remote: Counting objects: 7, done.
remote: Compressing objects: 100% (2/2), done.
remote: Total 3 (delta 0), reused 3 (delta 0)
Unpacking objects: 100% (3/3), done.
From https://github.com/schacon/simplegit
  * [new branch] serverfix -> origin/serverfix
```

- `git push origin --delete <branch>` : remote branch 삭제

```bash
$  git push origin --delete serverfix
To https://github.com/schacon/simplegit
  - [deleted] serverfix
```

# Fetch & Pull

- **remote의 변경 사항**을 **로컬로** 가져오는 작업
- `git pull` == `git fetch` && `git merge` \| `git rebase`

## Fetch
> 로컬 저장소에  트래킹 브랜치를 생성 또는 갱신한다.
 로컬 저장소에 해당 내용을 적용하기 위해서 merge를 수행해야 한다.
 merge를 수행해도 트래킹 브랜치는 삭제되지 않는다.

![](/assets/images/study_log/git&github/2025-04-05-CreateAndSaveRemoteRepository/fetch.png)

- `git fetch (remote)` : `<remote>/<branch>` 생성
- `git branch -r` : <span style="color:rgb(255, 0, 0)">로컬 저장소</span>의 **remote branch 목록** 확인
	- 트래킹 브랜치는 `git branch` 로 볼 수 없음
- `git remote update`, `git fetch --all` 
	- `git fetch` 의 경우 현재 branch 기준
	- 위 2개의 명령어는 **모든 트래킹 브랜치**에 **fetch를 실행**

![image](/assets/images/study_log/git&github/2025-04-05-CreateAndSaveRemoteRepository/image04.png)

![image](/assets/images/study_log/git&github/2025-04-05-CreateAndSaveRemoteRepository/image05.png)

![fetch branch 확인](/assets/images/study_log/git&github/2025-04-05-CreateAndSaveRemoteRepository/image06.png)

- `git branch -dr <remote>/<branch>` : 트래킹 브랜치  <remote\>/<branch\> 삭제

## Pull

- remote 저장소의 변경 사항을 **바로 로컬에 적용**
- remote와 로컬 저장소와 충돌 발생 시 충돌 문제를 해결해야 pull 가능

# Push

- `git push <remote> <branch>`
- `git push -u <remote> <branch>` : **현재 위치**한 로컬 브랜치의 **브랜치 추적 대상**을 설정
	- remote에 해당 branch가 없을 경우, **새로 생성**
	- `-u` 대신 `--set-upstream-to` 사용 가능
	- `git branch -u <remote>/<branch>` 로 push 없이 upstream 설정 가능
	- 최초 push는 `-u` 사용, 이후 `git push` 로 push
- fetch \| pull과 마찬가지로 **충돌 발생 시 push가 불가능**