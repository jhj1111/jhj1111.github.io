---
title: (Android) 7. REST API 연동(with Retrofit)
post_order: 7
thumbnail: /assets/images/study_log/Android/2025-09-19-AndroidRESTAPI/image.png
layout: post
author: jhj
categories:
  - StudyLog
  - Android
tags:
  - Android
  - ROOM
excerpt: Android api 데이터 교환
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# REST API

- REST(Representational State Transfer)
- API의 **엔드포인트 구조**를 구현하는 방식
- 자원(resource) : URI로 표현
- HTTP method(POST, GET, PUT, DELETE) 사용
    - 리소스에 행하는 행위를 표현

![image.png](/assets/images/study_log/Android/2025-09-19-AndroidRESTAPI/image.png)

```
주요 메소드
GET : 리소스 조회
POST:  요청 데이터 처리, 주로 등록에 사용
PUT : 리소스를 대체(덮어쓰기), 해당 리소스가 없으면 생성
PATCH : 리소스 부분 변경 (PUT이 전체 변경, PATCH는 일부 변경)
DELETE : 리소스 삭제

기타 메소드

HEAD : GET과 동일하지만 메시지 부분(body 부분)을 제외하고, 상태 줄과 헤더만 반환
OPTIONS : 대상 리소스에 대한 통신 가능 옵션(메서드)을 설명(주로 CORS에서 사용)
CONNECT : 대상 자원으로 식별되는 서버에 대한 터널을 설정
TRACE : 대상 리소스에 대한 경로를 따라 메시지 루프백 테스트를 수행
```

## GET

- 전체 리스트 조회 : GET/resoures
- 특정 리소스 조회 : GET/resources/:id

![image.png](/assets/images/study_log/Android/2025-09-19-AndroidRESTAPI/image%201.png)

## POST

- 새로운 자원 생성
- 서버에 Data 전송하기 위함(생성)
- PUT - 서버의 Resource에 대한 Data를 저장
- 생성 : POST/resources

```kotlin
body : {data : "data"}
Content-Type : "application/json"
```

## PATCH

- 존재하는 자원에 대한 부분 변경
- 특정 리소스 수정 : PATCH/resources/:id

![image.png](/assets/images/study_log/Android/2025-09-19-AndroidRESTAPI/image%202.png)

## PUT

- 존재하는 자원 변경
- 리소스 수정 : PUT/resources/:id

```kotlin
body : {data : "data"}
Content-Type : "application/json"
```

## DELETE

- 존재하는 자원에 대한 삭제
- 특정 리소스 삭제 : DELETE/resources/:id

# 디자인 가이드

- URI는 정보의 자원을 표현
- 리소스 명은 동사보다 명사 사용
- 자원에 대한 행위는 HTTP Method로 표현

```kotlin
GET /members/1 // OK
GET /membeers/retrive/1 // not OK
```

---

| 요청 | URL 예제 |
| --- | --- |
| 아메리카노 한 잔 주세요 | /coffee/americano |
| 망고 프라푸치노 한 잔 주세요 | /frappuccino/mango |
| 콜드브루 두 잔 주세요 | /coffee/coldbrew?quantity=2 |
| 아메리카노 두 잔 전부 헤이즐넛 시럽 넣어주세요 | /coffee/americano?quantity=2&syrup=hazelnet |

---

![image.png](/assets/images/study_log/Android/2025-09-19-AndroidRESTAPI/image%203.png)

# HTTP 상태코드

![image.png](/assets/images/study_log/Android/2025-09-19-AndroidRESTAPI/image%204.png)

---

![image.png](/assets/images/study_log/Android/2025-09-19-AndroidRESTAPI/image%205.png)

# Retrofit

- Square사 제작
- HTTP 클라이언트 라이브러리
- 안드로이드, Kotlin(JAVA)에서 HTTP API 통신을 위한 **타입 안전성(type-sate)**을 지원
- 서버 - 클라이언트 데이터 교환 단순화, JSON 형식 이용
    - JSON → 객체 변환(Gson, Moshi 등)
- **비동기** 네트워크 처리 간편화(자체적 비동기 처리 지원)

## 특징

- **유형 안전성(Type-safe)** : 데이터 형식 지정 → 컴파일 오류 감지
- **간결한 코드** 작성 : interface, annotation → API 요청 정의, 자동 파싱 기능
- **확장성** : 다양한 COnverter(예 Gson, Moshi)를 지원
    - JSON, XML 등 데이터 포맷 처리
    - RxJava, Coroutines와 같은 비동기 프로그래밍 라이브러리와 연동 가능
- **비동기** 처리
- **OkHttp** 기반 : OkHttp 라이브러리를 기반으로 구축 → 안정성과 성능 보장

## 사용 방법

- build.gradle 의존성 추가

```kotlin
// build.gradle (Module: app)
dependencies {
    implementation 'com.squareup.retrofit2:retrofit:2.x.x'
    implementation 'com.squareup.retrofit2:converter-gson:2.x.x' // Gson 컨버터 추가
}
```

- AndroidManifest.xml 권한 추가

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

		
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

		...
    <application
    ...
```

- interface 생성

```kotlin
// 서버 응답으로 받아올 데이터 모델 클래스
interface ApiService {
    @GET("users/{id}")
    fun getUser(@Path("id") id: Int): Call<User>
}
```

- Retrofit 인스턴스를 생성

```kotlin
val retrofit = Retrofit.Builder()
    .baseUrl("https://api.example.com/")
    .addConverterFactory(GsonConverterFactory.create())
    .build()

val apiService = retrofit.create(ApiService::class.java)
```

- 동기식 요청

```kotlin
al response: Response<User> = apiService.getUser(id).execute()
```

- 비동기식 요청

```kotlin
apiService.getUser(id).enqueue(object: Callback<User> {
    override fun onResponse(call: Call<User>, response: Response<User>) {
        
			if (response.isSuccessful) {
			    val user: User? = response.body()
				} 
	    }

    override fun onFailure(call: Call<User>, t: Throwable) {
        // 오류 처리
        Log.e("API_ERROR", t.message ?: "Unknown error")
    }
})
```

- [카카오 예시](https://nbcamp.spartacodingclub.kr/blog/%EA%B0%9C%EB%85%90-%EC%BD%95-%EC%95%88%EB%93%9C%EB%A1%9C%EC%9D%B4%EB%93%9C-retrofit-21651)

## 핵심 개념

- annotation
    - HTTP 메소드 : `@GET`, `@PUT`, `@DELETE`, `@PATCH`
    - API 요청 파라미터 지정 : `@Path`, `@Query`, `@Body`
- Call : 비동기 API 요청을 나타내는 인터페이스
- Callback : API 응답을 처리하는 인터페이스
- Converter : JSON, XML 등 데이터를 객체러 변환해주는 라이브러리

```kotlin
public interface ApiService {
	//POST 요청: 새 사용자 생성
	@POST("users")
	suspend fun createUser(@Body user: User)
	// PUT 요청: 사용자 정보 업데이트
	@PUT("users/{id}")
	suspend fun updateUser(@Path("id") userId: Int, @Body user: User)
	// DELETE 요청 : 사용자 삭제
	@DELETE("users/{id}")
	suspend fun deleteUser(@Path("id") userId: Int)
}
```

## 쿼리, 경로 파라미터

- `@Path` : 경로파라미터, URL 경로의 일부로 사용되는 변수
    - 주로 정제되지 않은 데이터(조건 X)
- `@Query` : 쿼리 파라미터, URL 쿼리 문자열로 전달되는 변수
    - 조건을 통한 데이터 선택(SELECT)

![image.png](/assets/images/study_log/Android/2025-09-19-AndroidRESTAPI/image%206.png)

---

![image.png](/assets/images/study_log/Android/2025-09-19-AndroidRESTAPI/image%207.png)

---

![image.png](/assets/images/study_log/Android/2025-09-19-AndroidRESTAPI/image%208.png)

## 요청(Request Body)

- `@Body` : POST, PUT 요청에서 JSON 데이터를 전송하기 위한 본문
    - 요청/응답의 **실제 데이터(payload)**
    - 일반적으로 JSON, XML, Form 데이터 등
- `@Body` → 객체를 JSON으로 직렬화해서 요청 본문에 넣음
- `@Field`, `@FormUrlEncoded` → 폼 데이터 전송
- `@Part`, `@Multipart` → 파일 업로드

```kotlin
public interface ApiService {
	//POST 요청: 새 사용자 생성
	@POST("users")
	suspend fun createUser(@Body user: User)

	// 쿼리 파라미터 사용
	@GET("users")
	suspnd fun getUserByAge(@Query("age") age: Int): User
}
```

---

```kotlin
data class UserUpdateRequest(
    val name: String,
    val email: String
)

interface ApiService {
    @PUT("users/{id}")
    suspend fun updateUser(
        @Path("id") userId: Int,
        @Body request: UserUpdateRequest   // body에 JSON 담김
    ): Response<User>
}
```

## 헤더(Headers)

- `@Headers` : API 요청 시 특정 헤더
    - 요청/응답에 대한 **부가 정보(metadata)**
    - 요청 자체를 설명하거나 인증/인코딩/캐시 등 **프로토콜 수준**의 정보를 담음
    - `{}` : 복수 헤더 설정

```kotlin
public interface ApiService {
	// 단일 헤더 설정
	@GET("users")
	suspend fun getUsers(@Headers("Authorization") token: String): List<User>
	
	// 복수 헤더 설정
	@Headers({ "Accept: application/json", "User-Agent: Retrofit-Sample" })
	@GET("users")
	suspend fun getUsersWithHeaders()
}
```

---

```kotlin
interface ApiService {
    @GET("users")
    suspend fun getUsers(
        @Header("Authorization") token: String,   // 동적 헤더
        @Header("Accept") accept: String = "application/json" // 기본값
    ): Response<List<User>>
}
```

## clean architecture

- UI Layer : 데이터 표시 및 사용자 입력 처리 (Jetpack Compose)
- ViewModel : UI와 데이터 계층 연결, LifecycleScope 내에서 비동기 실행
- Repository: API 호출 로직을 한 곳에 모아 UI에서 직접 네트워크 호출하지 않도록 함
- Retrofit : API 호출 및 JSON → 객체 변환 담당
- REST API 서버 : 외부 데이터 제공

## 예시

- [https://velog.io/@haileeyu21/Session-RESTful-API-%EB%9E%80-Path-parameters-Query-string](https://velog.io/@haileeyu21/Session-RESTful-API-%EB%9E%80-Path-parameters-Query-string)
- 주목해야할 점은 **RESTful API 관점**에서의 **주소 이름**이다.
- 장바구니에서 `수량 삭제와 추가(PATCH)`, `아이템 삭제(DELETE)`, `장바구니 데이터 받아오기(GET)` 모두 **같은 API URI**에서 이루어진다는 점이다.즉, **장바구니 데이터**가 중심이 되어 `order/cart`라는 URI에 `method`에 따라 행할 수 있는 **행위를 정하는 것**이다.

```kotlin
addItem = e => {
    fetch("http://10.168.1.160:8000/order/cart", {
      method: "PATCH",
      body: JSON.stringify({
        cart_item_id: e.target.id,
        delta: "plus",
      }),
    })
      .then(res => res.json())
      .then(result => {
        result.MESSAGE === "SUCCESS" ? this.getData() : console.log("실패!");
      });
  };
{/*이외에도 수량 감소, 삭제(DELETE) 등에 대한 함수가 있다.*/}
getData = async () => {
    const response = await fetch("http://10.168.1.160:8000/order/cart");
    const data = await response.json();
    this.setState({ cartData: data.items_in_cart });
  };
```