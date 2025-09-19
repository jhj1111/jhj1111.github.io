---
title: (Android) 1. 파일 키 숨기기
post_order: 1
thumbnail: https://www.ibm.com/content/dam/connectedassets-adobe-cms/worldwide-content/stock-assets/adb-stk/ul/g/ac/98/adobestock_876865630.component.crop-2by1-xl.ts=1756122272469.jpeg/content/adobe-cms/kr/ko/think/topics/data-security/jcr:content/root/leadspace_container/leadspace_article
layout: post
author: jhj
categories:
  - StudyLog
  - Android
tags:
  - Android
  - Secure
  - FileKey
excerpt: 파일 키(api key 등) 보안
project_rank: "680"
sticker: emoji//1 f 4 aa
---


# 파일 키 숨기기

# local.properties 파일에 키 추가

- 주의 : .gitignore에 파일 추가 필요
- `""` 없이 입력

```kotlin
properties
NAVER_CLIENT_ID = 여기에_실제_Naver_Client_ID_입력
NAVER_CLIENT_SECRET = 여기에_실제_Naver_Client_Secret_입력
```

# app/build.gradle.kts 파일 설정

- android 블록 내에서 `local.properties` 키를 읽을 수 있도록 `buildConfigField` 정의
- `java.util.Properties` : import 필요
- `rootProject.file("local.properties")` : 프로젝트 최상위 디렉토리의 local.properties 파일을 참조합니다.
- `localProperties.getProperty("NAVER_CLIENT_ID")` : local.properties에서 해당 키의 값을 읽어옵니다. ?: ""는 값이 없을 경우 빈 문자열을 사용하도록 하는 안전장치입니다 (이 경우 키가 없으면 빌드 시 빈 문자열로 설정되지만, 실제로는 키가 항상 있어야 합니다).
- `buildConfigField("String", "NAVER_CLIENT_ID", "\"...\")`•
    - 첫 번째 인자: 생성될 필드의 타입 (String)
    - 두 번째 인자: BuildConfig 클래스에 생성될 필드의 이름 (NAVER_CLIENT_ID)
    - 세 번째 인자: 필드에 할당될 값. 문자열 값은 이중 따옴표로 다시 감싸주어야 합니다 ("\"${...}\"")
- 완료 후 Sync Now 실행

```kotlin
import java.util.Properties // 파일 상단에 추가 (필요한 경우)

// ... 다른 설정들 ...

android {
    // ... 기존 android 설정들 ...

    defaultConfig {
        // ... 기존 defaultConfig 설정들 ...

        // local.properties 파일 로드
        val localProperties = Properties()
        // 프로젝트 루트의 local.properties
        val localPropertiesFile = rootProject.file("local.properties")
        if (localPropertiesFile.exists()) {
            localProperties.load(localPropertiesFile.inputStream())
        }

        // BuildConfig 필드 정의
        buildConfigField("String", "NAVER_CLIENT_ID", "\"${localProperties.getProperty("NAVER_CLIENT_ID") ?: ""}\"")
        buildConfigField("String", "NAVER_CLIENT_SECRET", "\"${localProperties.getProperty("NAVER_CLIENT_SECRET") ?: ""}\"")
    }

    // ... buildFeatures { buildConfig = true } 가 이미 있거나 추가 필요 ...
    // buildConfig true로 설정 (대부분 기본값으로 true지만 명시적으로 확인)
    buildFeatures {
        buildConfig = true
    }

    // ... 나머지 android 설정들 ...
}

// ... 나머지 설정들 ...
```

# ArticleRepository.kt 파일 수정

> 중요: ArticleRetrofit.api.getArticles 메소드의 시그니처(파라미터 순서 및 개수)가 ArticleRepository에서 호출하는 방식과 일치해야 합니다. 
아래 코드에서는 clientId와 clientSecret가 getArticles 메소드의 파라미터로 전달된다고 가정했습니다. 
만약 Retrofit 인터페이스 (ArticleApi.kt)에서 이미 헤더에 고정된 값을 사용하고 있다면, 해당 인터페이스 자체에서 BuildConfig 값을 참조하도록 수정할 수도 있지만, 일반적으로는 호출하는 쪽에서 동적으로 값을 제공하는 것이 더 유연합니다.
> 
- `import com.example.restapipractice.BuildConfig`
- `BuildConfig.configName` : `configName`으로 설정한 property 사용
- import 오류가 떠도 **일단 실행해보자**
    - 기본적으로 설정 후 **실행해야 import**가 된다.

```kotlin
package com.example.restapipractice.data.repository

import com.example.restapipractice.BuildConfig // BuildConfig 임포트!
import com.example.restapipractice.data.remote.ArticleRetrofit
import com.example.restapipractice.data.remote.api.ArticleDto // ArticleDto가 ArticleRetrofit에서 사용된다면

class ArticleRepository {
    suspend fun getArticles(
        query: String,
        display: Int = 10,
        start: Int = 1,
        sort: String = "sim",   // sim: 유사도순, date: 날짜순
    ): ArticleDto { // ArticleDto가 반환 타입이라면 해당 클래스로 변경 필요
        return ArticleRetrofit.api.getArticles(
            // @Header("X-Naver-Client-Id") clientId: String,
            // @Header("X-Naver-Client-Secret") clientSecret: String,
            // Retrofit 인터페이스의 헤더 파라미터는 그대로 두고, 호출 시 BuildConfig 값을 전달
            clientId = BuildConfig.NAVER_CLIENT_ID,
            clientSecret = BuildConfig.NAVER_CLIENT_SECRET,
            query = query,
            // display = display, // ArticleApi.kt의 getArticles 메소드 시그니처와 일치해야 함
            // start = start,
            // sort = sort
        )
    }
}
```

---

```kotlin
// ArticleApi.kt
interface ArticleApi {
    @GET("search/news.json")
    suspend fun getArticles(
        @Header("X-Naver-Client-Id") clientId: String, // 이 파라미터로 BuildConfig.NAVER_CLIENT_ID가 전달됨
        @Header("X-Naver-Client-Secret") clientSecret: String, // 이 파라미터로 BuildConfig.NAVER_CLIENT_SECRET이 전달됨
        @Query("query") query: String,
        // 필요하다면 display, start, sort 파라미터도 추가
        // @Query("display") display: Int,
        // @Query("start") start: Int,
        // @Query("sort") sort: String
    ): ArticleDto // 또는 실제 API 응답 DTO
}
```

# 기타

- 기본적으로 `BuildConfig` import 오류가 뜬다면 무시하고 실행
    - 실행해야 해결이 될 수도 있음
- 위 방법으로도 안된다면
- `build.gradle.kts(:app)` 의 `buildConfig = true` 확인

```kotlin
    ...
    buildFeatures {
        compose = true
        buildConfig = true // BuildConfig 사용 설정
    }
    ...
```

- `gradle.properties` 에 다음 추가(project root에 존재)

```kotlin
android.defaults.buildfeatures.buildconfig=true
```