---
title: (Android) 4. ViewModel
post_order: 4
thumbnail: https://developer.android.com/static/codelabs/basic-android-kotlin-compose-viewmodel-and-state/img/61eb7bcdcff42227.png?hl=ko
layout: post
author: jhj
categories:
  - StudyLog
  - Android
tags:
  - Android
  - ViewModel
excerpt: Android 구동 제어
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# Android Architecture Components

> google이 앱 구조를 표준화하기 위해 만든 아키텍처 라이브러리 세트
> 

| 구성요소 | 설명 |
| --- | --- |
| ViewModel | UI 데이터를 수명 주기에 안전하게 저장 |
| LiveData/StateFlow | 데이터 변경을 감지하여 UI 갱신 |
| Room | SQLite를 추상화한 영속성 라이브러리 |
| Lifecycle | Activity/Fragmemt 수명 주기 관찰 |
| Navigation | Fragment 간 안전한 이동 처리 도구 |

# MVVM(Model-View-ViewModel)

- 사용자 인터페이스 개발을 위한 아키텍쳐
- 관심사의 분리를 통해 코드의 테스트 용이성, 유지보수성, 유연성을 높이는 것

## Model

- **데이터**와 **비즈니스 로직** 담당
- 데이터 소스(네트워크, 데이터베이스, 파일 등)로부터 데이터를 가져오고 저장, 가공
- UI와 **독립적**으로 존재
- ViewModel 혹은 다른 로직 계층에 **데이터를 제공**
- 일반적으로 POJO(Plain Old Java Object) 또는 Kotlin의 데이터 클래스와 데이터를 처리하는 리포지토리(Repository) 등으로 구성
- ViewModel/View에 대한 직접적인 참조를 가져서는 안됨

## View

- 사용자에게 보여지는 UI
- 입력 → ViewModel 혹은 ViewModel → data를 받아 화면에 표시
    - state와 다르기 때문에 처리가 필요
- 자체 애플리케이션 로직을 가지지 않아야 하고, 단순히 ViewModel이 제공하는 데이터를 화면에 어떻게 보여줄지에 대한 책임만 가진다.
    - 데이터의 처리를 직접 실행하지 않음
    - Corutin 사용
- ViewModel의 **observer**, **data 변경**(event) → **UI 업데이트**
- Activity 혹은 Fragment

## ViewModel

- View를 위한 모델
- View에 표시될 데이터와 이벤트를 처리하는 로직
- View-Model 사이의 중개자
- View input → Model에 요청(필요 시)
- Model로 받은 data rkrhd → View
- View에 대한 직접적인 참조 X
- LiveData나 StaeFlow와 같은 관찰 가능한 데이터 홀더를 통해 View에게 변경 사항 알림
    - View가 변경/교체에 영향 X
- UI State 관리, 화면 구성 변경(회전 등)에도 데이터를 유지
- Jetpack의 ViewModel class

## ViewModel의 선언 및 사용법(Compose)

- androidx.lifecycle: lifecycle-viewmodel-compose 라이브러리
    - viewModel() 함수를 사용 → ViewModel instance
- 의존성 추가

```kotlin
// build.gradle.kts (:app)

plugins {
  // Kotlin serialization plugin for type safe routes and navigation arguments
  kotlin("plugin.serialization") version "2.0.21"
}

dependencies {
  val nav_version = "2.9.3"
	
	// ViewModel
	implementation("androidx.lifecycle:lifecycle-viewmodel-compose:$nav_version")
	
	// LiveData
	implementation("androidx.compose.runtime-runtime-livedata:1.8.3")
	
	// StateFlow
	implementation("androidx.lifecycle:lifecycle-runtime-compose:$nav_version")

	// 기타
  // Jetpack Compose integration
  implementation("androidx.navigation:navigation-compose:$nav_version")

  // Views/Fragments integration
  implementation("androidx.navigation:navigation-fragment:$nav_version")
  implementation("androidx.navigation:navigation-ui:$nav_version")

  // Feature module support for Fragments
  implementation("androidx.navigation:navigation-dynamic-features-fragment:$nav_version")

  // Testing Navigation
  androidTestImplementation("androidx.navigation:navigation-testing:$nav_version")

  // JSON serialization library, works with the Kotlin serialization plugin
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
}
```

- class 선언
    - androidx.lifecycle.ViewModel을 상속
- getter/setter 방식으로 사용(event observer이기 때문)
- `MutableStateFlow(initailize)` : Flow 상태 저장
    - 초기값 필수
    - state를 비동기적으로 저장
- `asStateFlow()` : `StateFlow`로 형변환
- `viewModelScope.launch { Corutin block }` : Corutin 실행
    - `globalScope` : 앱 전체 Scope
    - `viewModelScope`
    - `launch` : 명령만 던짐
    - `async` : return값 필요 시

```kotlin
// ViewModelMain
class CounterViewModel: ViewModel() {
    // private MutableStateFlow
    private val _counter = MutableStateFlow(0)
    //public read-only StateFlow
    val count: StateFlow<Int> = _counter.asStateFlow()
	  // val count: StateFlow<Int> get() = _counter.asStateFlow()
    
    fun incrementCounter() {  // Setter
        // ViewModelScope를 사용하여 코루틴에서 상태 변경
        viewModelScope.launch {
            _counter.value++
        }
    }
}
```

- viewModle()의 instance : method(corutine 실행), data(.value)
- `instanceViewModel.counter.collectAsState()` : `StateFlow`를 `State`형태로 받아옴
    - `StateFlow` : StateMuchine에서 관리
    - `collectAsState()` : `stream` → `state` 상태로 변환

```kotlin
// Main
    val viewModelCount = viewModel.count.collectAsState()

    Column(modifier = modifier) {
        Text(
            text = """
                |Hello $name!
                |your id : $id,
                |password : $password
            """.trimMargin()
        )

        Button(onClick = {
            onIncrementCount
        }) {
            Text(count.toString())
        }

        Button(onClick = {
            viewModel.incrementCounter()
        }) {
            Text("ViewModel StateFlow 사용 카운트: ${viewModelCount.value}")
        }
    }
```

# View ↔ ViewModel

- View → ViewModel
    - 이벤트 발생: veiwModelScope.launch {…} 코루틴 처리
- ViewMoel → View
    - StateFlow / LiveDate 구독(collectAsState, collectAsStaeWithLifecycle)
- 참고
    - StateFlow : Kotlin Coroutines Flow library 기반, lifecycle 함수 필요
    - LiveDate : Android Lifecycle library 기반, lifecycle 인식 가능

# LiveData

- 안드로이드 기반 Jetpack의 아키텍처 컴포넌트
- 관찰 가능한 데이터 홀더 클래스
- 특징
    - lifecycle 인식 : Activity / Fragment가 STARTED 또는 RESUME 상태일 때만 업데이트 알림
    - UI와 데이터의 자동 동기화 가능
    - 메모리 누수 방지(lifecycle 연동)
- `LiveDat<T>` : 외부(UI)에서 구독 전용
- `MutableLiveData<T>` : 내부(ViewModel)에서 값 변경 가능(postValue, setValue)
- `observe()` : 라이프사이클에 맞춰 UI 자동 업데이트

```kotlin
// 읽기 전용
val data: LiveDate<String>

// 변경 가능(내부에서만 사용)
private val _data = MutableLiveData<String>()
val data: LiveData<String> get() = _data

// 메인 스레드에서 즉시 변경
_data.value = "data"

// 백그라운드 스레드에서 안전하게 변경
_data.postValue("background update")
```

## LiveData + Compose observeAsState()

- 선언 및 ViewModel

```kotlin
class CounterLiveModel: ViewModel() {
    private val _counter = MutableLiveData(0)
    val counter: LiveData<Int> get() = _counter
    
    fun incrementCounter() {
        _counter.value = (_counter.value ?: 0) + 1
    }
}
```

- Compose에서 구독 및 UI표시
- `observeAsState(initial)` : 초기값 필수

```kotlin
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun GreetingMain(
		viewModel: CounterViewModel = viewModel(),
    liveModel: CounterLiveModel = viewModel(),
) {
    val viewModelCount = viewModel.count.collectAsState()
    val liveModelCount = liveModel.counter.observeAsState(0)

        Button(onClick = {
            viewModel.incrementCounter()
        }) {
            Text("ViewModel StateFlow 사용 카운트: ${viewModelCount.value}")
        }

        Button(onClick = {
            liveModel.incrementCounter()
        }) {
            Text("LiveData 사용 카운트: ${liveModelCount.value}")
        }
    }
}
```