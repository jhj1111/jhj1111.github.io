---
title: (Android) 2. Jetpack Compose UI 기초
post_order: 2
thumbnail: https://blog.kakaocdn.net/dna/bhH7hl/btsuh4G8H4f/AAAAAAAAAAAAAAAAAAAAALwiJPZZkhFJbrxwZhWN1IJt_Fe9qAAH43hmVcyvv6s6/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1759244399&allow_ip=&allow_referer=&signature=a0fJkRYtHh2tnf5P4VzYv2XWeV8%3D
layout: post
author: jhj
categories:
  - StudyLog
  - Android
tags:
  - Android
  - JatpackCompose
  - UI
excerpt: Jetpack Compose UI의 기본 기능 및 요소
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# 구성 및 특징

- Activity(UI) + xml(Design)
- **MVVM**(Model, View, ViewModel)
    - Model : DB, file 등
    - View : UI, Activity 등
    - ViewModel : Controller
- **Jetpack Compose UI** : **programming code**로 UI 구현, xml 사용 X
- **Jetpack Room DB** : lcocal DB(SQLite)
- **REST API** : 두 컴퓨터 시스템이 인터넷을 통해 정보를 안전하게 교환하기 위해 사용하는 인터페이스
- Firebase
    - Real DB 사용
    - Auth 등 flatform 사용

# 프로젝트 생성 및 UI 구성

- New → 새 프로젝트 → empty project

![image.png](/assets/images/study_log/Android/2025-09-19-JetpackComposeUI/image.png)

- root : java

![image.png](/assets/images/study_log/Android/2025-09-19-JetpackComposeUI/image%201.png)

- preview
    - UI 구현 확인
    - 데이터 이동은 확인 X

![스크린샷 2025-08-26 10-40-25.png](/assets/images/study_log/Android/2025-09-19-JetpackComposeUI/preview.png)

---

![image.png](/assets/images/study_log/Android/2025-09-19-JetpackComposeUI//image%202.png)

- 재생 아이콘 : run app, 에뮬레이터 실행

![image.png](/assets/images/study_log/Android/2025-09-19-JetpackComposeUI//3562ddf4-ca5e-41fc-ba6c-e155542e9b26.png)

# Jetpack Component

## 구성

- `ComponentActivity` : jetpack component 상속(import androidx.activity.ComponentActivity)
- `onCreate` : 진입점
- `*setContent` : src 작성*
- `ui.theme` : 전역 design 영역(local 설정 시 setContent 이용)
- `@composable` : UI 디자인 설정 영역(Annotation)
- `modifier` : UI 세부 설정(size, padding 등)

```kotlin
package com.example.myapplication

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.example.myapplication.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    Greeting(
                        name = "Android",
                        modifier = Modifier.padding(innerPadding)
                    )
                }
            }
        }
    }
}

@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
    Text(
        text = "Hello $name!",
        modifier = modifier
    )
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    MyApplicationTheme {
        Greeting("Android")
    }
}
```

## 특징

- xml vs jetpack compose
- **빠른 러닝 커브 & 기존 자료 활용**이 중요하다면 → **XML**
- **장기적 유지보수성, 생산성, 최신 패러다임 적응**이 필요하다면 → **Jetpack Compose**

| 항목                | XML 기반 UI                                                                                               | Jetpack Compose                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **UI 작성 방식**    | 선언적이 아닌 명령형 + XML로 레이아웃 정의 후 Java/Kotlin에서 로직 연결                                   | 완전 선언형(Composable 함수) 방식, Kotlin 코드로 UI와 로직을 통합                           |
| **구조**            | UI(XML)와 로직(Kotlin/Java)이 파일/레이어로 분리됨 → Activity/Fragment/View Binding 필요                  | UI와 로직이 같은 Kotlin 코드에서 정의됨 → 더 직관적이고 구조 단순                           |
| **뷰 바인딩**       | `findViewById`, DataBinding, ViewBinding 등을 통해 뷰와 연결                                              | 별도의 바인딩 불필요, 함수 호출로 직접 뷰 접근 가능                                         |
| **러닝 커브**       | Android 개발 초기에 많이 사용, 자료 풍부 / 단점: 복잡한 레이아웃에서 XML & Kotlin 동기화가 헷갈릴 수 있음 | 새로운 패러다임(선언형 UI) 학습 필요 / Compose 전용 문법 & 개념 적응 필요                   |
| **유지보수**        | 레이아웃과 로직이 분리되어 있어 파일 이동/변경이 잦음 / XML과 코드 불일치로 버그 발생 가능                | 하나의 Kotlin 코드에서 관리 → 유지보수 간결 / 재사용성과 확장성 ↑                           |
| **성능**            | 레이아웃 인플레이트(XML 파싱)로 초기 로딩 오버헤드 있음                                                   | 불필요한 인플레이트 없음 / Recomposition 기반이라 효율적이나 복잡한 recomposition 관리 필요 |
| **미리보기 & 툴링** | Android Studio의 Layout Editor 제공 (드래그&드롭 가능)                                                    | Compose Preview 제공 / 실시간 코드 변경 반영 / 레이아웃 에디터는 없음                       |
| **테스트 용이성**   | UI 테스트 시 Espresso, Robolectric 사용 → XML 기반의 계층 탐색 필요                                       | Compose Testing 라이브러리 제공, Composable 함수 단위 테스트 쉬움                           |
| **코드 재사용성**   | Custom View, include, merge 등을 활용해야 함                                                              | Composable 함수 재사용 가능 / Modifier로 확장성 높음                                        |
| **커뮤니티 & 자료** | 오랜 기간 표준 → 자료, 튜토리얼 풍부                                                                      | 최신 트렌드이자 구글 권장 → 자료 빠르게 늘고 있으나 XML보다는 부족                          |

- UI 개발 툴킷
- Kotlin 기반
    - 선언적인 접근 방식
- `@Composable` 표시된 일반 함수로 구성
    - 즉 함수에 Annotation만 지정해주면 UI 생성이 가능

# 화면 표시 단위 개념

> dp, sp, DPI
> 
- DPI(Dots Per Inch) : 화면의 픽셀 밀도, 화면 1인치(2.54cm)안에 있는 픽셀의 수
- **dp**(density-independent pixel) : 밀도 독립적인 픽셀 단위
    - 가장 많이 사용
    - 기기에 따라 자동으로 조절되는 크기 단위
    - 해상도와 관계없이 동일
- sp(scale-independent pixel) : 사용자 설정을 반영하는 텍스트 전용 단위
    - 글꼴 크기 사용 설정 반영
    - **문자열(텍스트)** 크기를 나타내는 용도
    - 사용자 설정한 텍스트 크기에 따라 조절

# @Composable 함수 특징

- **return값 없음(Unit)**
- 함수 이름 : UpperCamel
- 파라미터를 받아 구성
- **상태와 연동**되어 있음
    - 상태 변화 혹은 이벤트 발생 시 자동 실행

## 레이아웃

![image.png](/assets/images/study_log/Android/2025-09-19-JetpackComposeUI//image%203.png)

---

```kotlin
@Composable
fun SearchResult() {
    Row {
        Image(
            // ...
        )
        Column {
            Text(
                // ...
            )
            Text(
                // ...
            )
        }
    }
}
```

---

```
SearchResult
  Row
    Image
    Column
      Text
      Text
```

- `modifier` : 크기, 패딩, 정렬 등
- `HorizontalAlignment (ROW)`
- `verticalAlignment (ROW)`
- `verticalAlignment (Column)`
- `horizontalArrangement (Column)`
- `contentAlignmnet (Box)` : 내부 자식들의 정렬 방식

```kotlin
Column {
    Image(
        image,
        contentDescription = "dd"
    )

    Row {
        Text(
            text = "Hello $name!",
            fontSize = 20.sp,
            fontStyle = FontStyle.Italic,
            modifier = Modifier
                .background(
                    shape = CircleShape,
                    color = Color(0xFFD0BCFF),
                )
                .padding(top = 10.dp)
                .alpha(0.2f)
                .size(width = 100.dp, height = 30.dp)
                .blur(radius = 1.dp)
        )

        Button(onClick = {
        }) {
            Text("누르지 마시오")
        }
    }
```

---

![image.png](/assets/images/study_log/Android/2025-09-19-JetpackComposeUI//f2211439-f10c-4792-ba52-96d9ed127194.png)

## Scaffold

- 앱의 기본 레이아웃 구조(화면 뼈대)

| 구성 요소 | 설명 | 대표적 사용 예시 |
| --- | --- | --- |
| **topBar** | 화면 상단에 위치하는 영역. `TopAppBar` 또는 `SmallTopAppBar` 등을 배치 | 앱 제목, 뒤로가기 버튼, 액션 버튼 |
| **bottomBar** | 화면 하단에 위치하는 영역. 보통 `BottomNavigation` 또는 `NavigationBar` 사용 | 탭 네비게이션, 주요 메뉴 |
| **floatingActionButton (FAB)** | 화면 하단에 띄워지는 원형 버튼. `FloatingActionButton` 컴포저블 사용 | 글쓰기, 추가, 메시지 작성 버튼 |
| **floatingActionButtonPosition** | FAB의 위치를 지정. `FabPosition.End`(기본), `FabPosition.Center` 사용 가능 | FAB를 중앙 또는 오른쪽에 위치 |
| **drawerContent** | 좌측에서 열리는 Navigation Drawer의 콘텐츠 | 사이드 메뉴, 설정, 사용자 프로필 |
| **drawerGesturesEnabled** | 드로어 제스처 사용 여부 (`true/false`) | 사용자가 스와이프로 드로어 열 수 있는지 여부 |
| **snackbarHost** | 화면 하단에 `Snackbar`를 표시하는 위치 지정 | 오류 메시지, 알림 |
| **content** | Scaffold의 본문 영역. 가장 중요한 콘텐츠를 배치 | 화면 UI 본문(리스트, 카드, 텍스트 등) |

---

```kotlin
MyApplicationTheme {
    Scaffold(modifier = Modifier.fillMaxSize(),
        topBar = { TopAppBar(title = { Text("탑바") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = {}) { Text("+") }
        },
        bottomBar = {
            BottomAppBar {
                Text(
                    "Bottom Bar",
                    modifier = Modifier.padding(16.dp)
                )
            }
        },

    )
```

---

![image.png](/assets/images/study_log/Android/2025-09-19-JetpackComposeUI//image%204.png)

## 파라미터

- `Text()` : 텍스트 출력 UI 함수
    - `text` : 표시할 문자열
    - `modifier` : 컴포넌트 크기, 패딩, 정렬 등 조절
    - `color`
    - `fontSize`
    - `textAlign` : 텍스트 정렬

```kotlin
    Text(
        text = "Hello $name!",
        fontSize = 20.sp,
        fontStyle = FontStyle.Italic,
        modifier = Modifier.background(
            shape = CircleShape,
            color = Color(0xFFD0BCFF),
        )
            .padding(top = 10.dp)
            .alpha(0.2f)
            .size(width = 100.dp, height = 30.dp)
            .blur(radius = 1.dp)
    )
```

- `Image()`
    - painterResource를 사용, 드로어블(drawable) 폴더의 이미지를 로드
    - `R.directory.imgName` : directory(drawable)의 img.*
    - `painter` : 표시할 이미지 리소스
    - `contentDescription` : 접근성을 위한 이미지 설정
    - `modifier` : 크기, 비율 조절 등
    - `contentScale` : 이미지 스케일 방식(예 : ContentScale.crop)

```kotlin
    val image = painterResource(R.drawable.dummy)
    Image(
        image,
        contentDescription = "dd"
    )
```

- `Button()`
    - `onClick = { exec_code }` : 클릭 이벤트 발생 시 실행되는 코드
    - `Text()` : 버튼 내부에 표시되는 텍스트
    - `modifier`
    - `enabled` (default : true) : 버튼 활성 혹은 비활성
    - `color`

```kotlin
        Button(onClick = {

        }) {
            Text("누르지 마시오")
        }
```

---

![image.png](/assets/images/study_log/Android/2025-09-19-JetpackComposeUI//b37d5cd1-ff41-42d2-8db7-9984e825436b.png)

- `TextField()` 혹은 `OutlinedTextField()`
    - `value` : 현재 입력 필드의 텍스트
    - `onValueChange` : 입력값이 변경될 때 호출
    - `label` : 입력 필드 위에 표시되는 레이블
    - `placeholder` : 입력값이 없을 때 나오는 텍스트
    - `keyboardOptions` : 키보드 타입 설정(예 : 숫자, 이메일 등)
    - `by remember` : 값을 기억

```kotlin
   TextField(
        value = text,
        onValueChange = { NewText -> text = NewText }, // 입력 값 변경 시 상태 업데이트
        label = { Text("입력 ㅇㅇ") }
    )
```

---

![image.png](/assets/images/study_log/Android/2025-09-19-JetpackComposeUI//image%205.png)

- `Spacer()` : 빈 공간 생성
    - 레이아웃 정렬 보조 : Column, Raw, Grid 같은 레이아웃 컴포저블 내에서 자식들의 정렬을 조절할 때 효과적
    - `modifier`

```kotlin
Spacer(modifier = Modifier.height(20.dp))
Spacer(modifier = Modifier.width(16.dp))
Spacer(modifier = Modifier.weight(1f))
```

- `Surface()` : UI 요소들을 그룹화하고 배경, 모양, 그림자, 테두리 등 공통적인 시각적 속성을 적용하는데 사용
    - Meterial Design의 표면의 개념을 나타냄
    - `modifier`
    - `shape` : RectangleShape(default), RoundedComerShape(size : DP), CircleShape
    - `color` 표면 배경색
        - MaterialThme.colorScheme.surface
        - MaterialThme.colorScheme.primary
        - MaterialThme.colorScheme.secondary 등

```kotlin
  Surface(
      modifier = Modifier.fillMaxSize(0.8f),
      contentColor = Color.Red
  ) {
      Greeting(
          name = "한글",
          modifier = Modifier.padding(innerPadding)
      )
  }
```