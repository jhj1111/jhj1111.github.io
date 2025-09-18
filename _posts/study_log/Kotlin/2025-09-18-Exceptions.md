---
title: (Kotlin) 10. 예외처리
post_order: 10
thumbnail: https://taehyungk.github.io/img/%EC%8A%A4%ED%81%AC%EB%A6%B0%EC%83%B7%202020-02-12%20%EC%98%A4%ED%9B%84%209.33.28.png
layout: post
author: jhj
categories:
  - StudyLog
  - Kotlin
tags:
  - Kotlin
  - Exceptions
excerpt: 예외처리 방법
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# 예외 종류

- 일반 예외 : 반드시 처리를 해야하는 항목
    - kotlin 지원 X
    - 즉 반드시 예외 처리를 할 필요 X
- 실행 예외(RuntimeException) 중심
    - throw IOException

# 구문

- `try ... catch ... catch ... [finally]`
    - 복수 catch 처리 가능

```kotlin
fun main() { 
    try {
        10/0
    } catch (e: ArithmeticException) {
        println(e.message)
    } finally {
        println("finally block")
    }

    println("ㅇㅇ")
}

>>>

App.kt:10:9: warning: division by zero.
        10/0
        ^^^^
/ by zero
finally block
ㅇㅇ
```

- `throw exceptionClass(message)`

```kotlin
fun divide(a: Int, b: Int): Int {
    if (b==0) {
        throw IllegalArgumentException("0으로 못나눔")
    }

    return a / b
}

fun executeDivide(a: Int, b: Int) {
    try {
        println(divide(a, b))
    } catch (e: IllegalArgumentException) {
        println(e.message)
    }

}

fun main() { 
    executeDivide(10, 0)    // 0으로 못나눔
    executeDivide(10, 3)    // 3
}
```

- sealed class 이용 : 실패를 하나의 상태로 사용

```kotlin
sealed class Result

data class Success(val result: Int): Result()
data class Failure(val errorMessage: String): Result()

fun safeDivide(a: Int, b: Int): Result {
    return if (b==0) {
        Failure("0 나누기")
    } else {
        Success(a / b)
    }
}

fun main() { 
    val result = safeDivide(10, 0)

    when (result) {
        is Success -> println("result : $result.result")
        is Failure -> println(result.errorMessage)
    }
}
```

# 예제

```kotlin
fun parseInt(str: String): Int?  = str.toInt()

fun main() { 
    try {
        println(parseInt("1235a21b34"))
    } catch (e: NumberFormatException) {
        println(e.message)  // For input string: "1235a21b34"
    }
}
```

---

```kotlin
fun main() { 
    val index = arrayOf(1,2,3)

    try {
        index[4]
    } catch (e: IndexOutOfBoundsException) {
        println(e.message)  // Index 4 out of bounds for length 3
    }
}
```

---

```kotlin
class InvalidAgeException(message: String = "invalid age"): Exception(message)

fun main() { 
    val age = 50

    if (age < 0 || age > 150) {
        throw InvalidAgeException()
    } else {
        println(age)
    }
}

>>>

Exception in thread "main" org.example.app.InvalidAgeException: invalid age
	at org.example.app.AppKt.main(App.kt:12)
	at org.example.app.AppKt.main(App.kt)
```

---

```kotlin
fun main() { 
    val array = arrayOf(0, 1, 2)
    val index = "3"  // Index 3 out of bounds for length 3
    val index = "a"  // 숫자를 입력하셈 java.lang.NumberFormatException: For input string: "a".message

    try {
        array[index.toInt()]
    } catch (e: NumberFormatException){
        println("숫자를 입력하셈 $e.message")
    } catch (e: IndexOutOfBoundsException) {
        println(e.message)
    }
}
```

---

```kotlin
sealed class DividResult
data class Success(val result: Int): DividResult()
data class Failure(val errorMessage: String): DividResult()

fun safeDivide(a: Int, b: Int): DividResult {
    if (b==0){
        return Failure("divided by 0")
    } else {
        return Success(a / b)
    }
}

fun main() { 
    val result1 = safeDivide(100, 0)
    val result2 = safeDivide(100, 17)
    val printDivide = { result: DividResult -> 
        when(result) {
            is Success -> result.result
            is Failure -> result.errorMessage
        } 
    }

    println(printDivide(result1))   // divided by 0
    println(printDivide(result2))   // 5
}
```