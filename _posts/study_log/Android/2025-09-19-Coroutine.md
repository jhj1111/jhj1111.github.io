---
title: (Android) 5. Corutine
post_order: 5
thumbnail: https://blog.yena.io/assets/post-img20/200428-02.jpg
layout: post
author: jhj
categories:
  - StudyLog
  - Android
tags:
  - Android
  - ViewModel
excerpt: Kotlin 쓰레드 제어
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# coroutine?

- 실행을 멈췄다가 나중에 다시 이어서 샐행 가능한 구조
- 일시 중단(suspend) → 다른 프로세스 → 중단 지점부터 재개(resume)
- 비동기 작업에 사용
- Kotlin : `suspend`, `CoroutineScope`

# 범위

- `CoroutineScope` : Coroutine Scope과 함께 작동, 소멸
    - 명시적 선언, 취소 가능
- `GlobalScope` : Main과 같은 lifecycle을 같는 coroutine

| Scope | 소속 | 자동 취소 시점 | 사용 목적 | 확장 함수/필요 설정 | 대표 사용 예시 |
| --- | --- | --- | --- | --- | --- |
| **`lifecycleScope`** | `LifecycleOwner` (Activity, Fragment) | Lifecycle이 **DESTROYED** 될 때 | UI 관련 작업 (화면이 사라지면 자동 취소) | `lifecycle-runtime-ktx` 필요 | `lifecycleScope.launch { ... }` |
| **`viewModelScope`** | `ViewModel` | ViewModel의 `onCleared()` 시점 | UI 데이터 로직, 네트워크/DB 처리 (ViewModel 생명주기에 맞춤) | `lifecycle-viewmodel-ktx` 필요 | `viewModelScope.launch { ... }` |
| **`CoroutineScope`** | 독립 생성 (`CoroutineScope(...)`) | 명시적으로 `cancel()` 호출해야 함 | 특정 작업 단위에 맞춘 코루틴 관리 | 별도 생성 필요 (`Job()`, `Dispatcher`) | `val scope = CoroutineScope(Dispatchers.IO); scope.launch { ... }` |
| **`GlobalScope`** | 전역 단일 객체 | 앱 프로세스 종료 전까지 살아있음 (자동 취소 X) | 앱 전역에서 살아있는 백그라운드 작업 (단, 권장 X) | 기본 제공 | `GlobalScope.launch { ... }` |

- 디스패치 : 코루틴이 실행될 스레드를 지정
    - Default, IO 자주 사용

| Dispatcher | 설명 | 쓰레드 사용 방식 | 주 사용 사례 |
| --- | --- | --- | --- |
| **`Dispatchers.Default`** | CPU 집약적인 작업을 처리하기 위한 기본 디스패처 | 공유된 백그라운드 스레드 풀 사용 (CPU 코어 수에 비례) | 대규모 연산, 정렬, 데이터 파싱, 알고리즘 실행 |
| **`Dispatchers.IO`** | I/O(입출력) 중심 작업 최적화 | 대규모 스레드 풀 사용 (Default보다 많은 스레드 허용) | 네트워크 요청, 파일 읽기/쓰기, DB 접근 |
| **`Dispatchers.Main`** | UI 업데이트 전용 (Android, JavaFX 등 UI 프레임워크) | 메인(UI) 스레드에서 실행 | UI 조작, 이벤트 처리 |
| **`Dispatchers.Unconfined`** | 현재 호출한 스레드에서 시작, 첫 suspend 후에는 재개 시점에 따라 스레드 달라질 수 있음 | 특정 스레드에 고정되지 않음 | 특별한 경우 (테스트, 빠른 전환 필요 시), 일반적으로 권장 X |
| **`newSingleThreadContext("Name")`** | 새로운 단일 스레드 생성 후 해당 스레드에 바인딩 | 항상 같은 하나의 스레드 사용 | 특정 순차적 작업 필요 시 (비효율적이라 잘 안 씀) |
| **`newFixedThreadPoolContext(n, "Name")`** | 지정된 개수의 스레드 풀 생성 | 항상 같은 개수의 스레드 사용 | 병렬 처리 제한 필요할 때 |

```kotlin
val scope = CoroutineScope(Dispatchers.Default)

scope.launch {
	println("백그라운드 작업 실행 중..")
}
```

- 코루틴 빌더
    - 코루틴 생성 함수
    - `launch` : return Job, 결과 값 없음, 실행만
    - `async` : Deferred<T> 결과 값 반환(await() 사용) 가능
- launch와 상태 관리
    - 반환값 job(결과 값 없음)을 변수에 저장 → 상태 관리용으로 사용
- `cancel` : 코루틴 종료
- `join` : 해당 코루틴이 끝날 때까지 Main 중단
- `async` : 연산 결과 받아 사용
    - `await` 함수를 통해 결과 값 받을 수 있음
- `runBlocking` : 현재 스레드 차단
    - 주로 테스트나 메인 함수에서 사용

```kotlin
import kotlinx.coroutines.*

fun main() = runBlocking {
    println("▶ 메인 시작")

    // 1) launch: 결과값 반환 없이 실행
    val job = launch {
        repeat(5) { i ->
            println("launch 코루틴 작업중... $i")
            delay(500L)
        }
    }

    // join: 해당 코루틴이 끝날 때까지 기다림
    job.join()
    println("▶ launch 코루틴 완료")

    // 2) cancel: 실행 중인 코루틴 중단
    val cancelJob = launch {
        repeat(10) { i ->
            println("cancel 코루틴 작업중... $i")
            delay(300L)
        }
    }
    delay(1000L)
    println("▶ cancel 호출")
    cancelJob.cancel()   // 코루틴 중단
    cancelJob.join()     // 중단까지 기다림
    println("▶ cancel 코루틴 종료됨")

    // 3) async: 결과값 반환 (Deferred)
    val deferred: Deferred<Int> = async {
        println("async 코루틴 계산 시작")
        delay(1000L)
        10 + 20  // 결과 반환
    }

    val result = deferred.await()  // async 결과 기다림
    println("▶ async 결과: $result")

    println("▶ 메인 종료")
}
```

---

```kotlin
fun main() {
	...
	runBlocking {
		launch {
			...
		}
		...
	}
	...
}
```

## suspend

- 일시중단
- 코루틴 안에서만 호출 가능(launch, async, runBlocking 또는 다른 suspend 함수 내)
- 실행 도중에 잠시 멈췄다가 나중에 다시 이어 실행 가능
- 스레드를 차단하지 않음, 대신 함수를 중단
- 주로 네트워크 요청, 파일 I/O, delay() 등 시간이 오래 걸리는 작업에 사용

```kotlin
import kotlinx.coroutines.*

suspend fun fetchDataFromServer(): String {
    println("서버에서 데이터 요청 중...")
    delay(1000L) // 네트워크 통신 시뮬레이션
    return "서버 응답 데이터"
}

suspend fun processData(data: String): String {
    println("데이터 처리 중...")
    delay(500L)
    return "처리된 데이터: $data"
}

fun main() = runBlocking {
    println("▶ 메인 시작")

    // suspend 함수 호출 (코루틴 내부에서만 가능)
    val rawData = fetchDataFromServer()
    val result = processData(rawData)

    println("▶ 최종 결과: $result")
    println("▶ 메인 종료")
}
```

- 호출 시 컨텍스트 전환 없이 같은 스레드에서 실행
- `withContext` : suspend 함수를 코루틴 스코프에서 호출할 때 호출한 스코프와 다른 Dispatcher 사용 필요 시 호출
    - Dispatcher 분리

```kotlin
import kotlinx.coroutines.*

suspend fun fetchData(): String = withContext(Dispatchers.IO) {
    println("데이터 가져오기 (스레드: ${Thread.currentThread().name})")
    delay(1000L) // 네트워크/DB I/O 작업 시뮬레이션
    "서버 데이터"
}

suspend fun processData(data: String): String = withContext(Dispatchers.Default) {
    println("데이터 처리 (스레드: ${Thread.currentThread().name})")
    delay(500L) // CPU 연산 시뮬레이션
    "처리된 데이터: $data"
}

fun main() = runBlocking {
    println("▶ 메인 시작 (스레드: ${Thread.currentThread().name})")

    val data = fetchData()       // IO Dispatcher에서 실행
    val result = processData(data) // Default Dispatcher에서 실행

    println("최종 결과: $result (스레드: ${Thread.currentThread().name})")
    println("▶ 메인 종료")
}
```