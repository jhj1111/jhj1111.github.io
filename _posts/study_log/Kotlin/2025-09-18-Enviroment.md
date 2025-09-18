---
title: (Kotlin) 1. 실행환경
post_order: 1
thumbnail: /assets/images/study_log/Kotlin/2025-09-18-Enviroment/thumnail.jpg
layout: post
author: jhj
categories:
  - StudyLog
  - Kotlin
tags:
  - Django
  - Rest Framework
  - command
excerpt: Kotlin 특징 및 파일트리
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# 특징

- java 연동
- JVM(Java Vertual Muchine) 환경에서 실행
    - JDK(Jave Development Kit)
- `;` : 선택사항, 기본적으로 indentation 기반

# directory 구조

- main : 실행 함수(진입점)
- test : test용 directory
- resources : xml 혹은 .properties - 환경설정 directory
- out : bit 파일(compiled)
- External Library : 의존 라이브러리

# 출력

- `print` : 개행 미포함
- `println` : 개행 포함
- 변수 출력
    - `$`, `${}` : 단일 변수, expression 변수 표현

```kotlin
fun main() {
    val name = "Kotlin";
    var num = 0.1;
    var numF = 0.1F;

    println("Hello, " + name + "!")

    for (x in 0..999) {
        num += 0.1;
        numF += 0.1F;
    }
    println("num:$num")
    print("numF:${numF + num}")
    println("  end")
}

>>>

Hello, Kotlin!
num:100.09999999999859
numF:200.1990447998033  end
```