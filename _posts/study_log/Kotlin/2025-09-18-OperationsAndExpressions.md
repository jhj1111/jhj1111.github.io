---
title: (Kotlin) 3. 연산자와 표현식
post_order: 3
thumbnail: https://typealias.com/img/start/conditionals/anatomy-when-annotated.png
layout: post
author: jhj
categories:
  - StudyLog
  - Kotlin
tags:
  - Kotlin
  - operations
  - expressions
excerpt: 연산자와 표현식 사용법
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# operation

- assignment : expression 가능

```kotlin
val variable = n1 + n2
```

- operation widening
- String overloading(+, <,>, ==, …)
- 대입 연산자
- 소수 비교의 경우
    - 자리수 주의

```kotlin
package org.example

fun main() {
    val n1 = .1
    val n2 = .1f
    val n3 = .1

    println(n1 == n2.toDouble())   // false
    println(n1 === n2.toDouble())  // false
    
    println(n1.toFloat() == n2)   // true
    println(n1.toFloat() === n2)  // true
    
    // println(n1 == n2)  // compile error
    /* 
    Main.kt:8:13: error: operator '==' cannot be applied to 'Double' and 'Float'
    println(n1 == n2)
            ^
    */
}
```

---

```kotlin
package org.example

fun main() {
    println(.1 + 1.1 == 1.2) // false
}
```

- 논리곱 : `&&`, `||`, `!`

# if/when assign

> `if`, `else if` , `else`
`if` 와 `when`조건문이 return 값을 가지며, assignmnet 기능을 가짐.
python보다 더 함수형 언어의 특징을 더 가진 듯.
> 

## if/else if/else

- `if(condition) true_value else false_value`
- `if(condition) {case_1_block} else if(condition) {case_n_block} else {else_block}`
    - 단순한 2항 연산을 넘어 if-else if-else 함수 return을 assign 가능
- **block**의 **마지막 값**을 **return 값**으로 사용

```kotlin
package org.example

fun main() {

    println(caseVal(1, 2))      // lt
    println(caseVal(1, 1))      // sm
    println(caseVal(20, 10))    // gr
}

fun caseVal(var1: Int, var2: Int): String{
    val result = if(var1 > var2){
        "aaaaa"
        "gr"
    }
    else if(var1 == var2) {
        "aaaaa"
        "sm"
    }
    else{
        "aaaaa"
        "lt"
    }

    return result
}
```

## when

- `when (compare){ value -> result_1; ...; else -> result_n}`
    - `->` : assign

```kotlin
package org.example

fun main() {
    val day = 1
    val dayName = when (day){
        1 -> "M"
        2 -> "T"
        3 -> "W"
        else -> "?"
    }

    println(dayName)  // M
}
```

## 예제

```kotlin
package org.example

fun main() {
    val x = 10
    val y = 5
    val strRet: String = "x + y = " + (x+y).toString()
    val strRet: String = "x + y = ${x+y}"

    println(strRet)
}
```

---

```kotlin
package org.example

fun main() {
    val value = 356

    println(value - value%100)
}
```

---

```kotlin
package org.example

fun main() {
    println(categoryByAge(10))   // child
    println(categoryByAge(15))   // youth
    println(categoryByAge(9999)) // adult
}

fun categoryByAge(age: Int) = when {
    age < 13 -> "child"
    age in 13..19 -> "youth"
    else -> "adult"
}
```

# 조건문

- 순차 :  위에서부터 순차적으로 한 줄 단위로 실행 하는 것
- 조건 : 주어진 조건이 참 혹은 거짓일 경우에 따라 실행 하는 것
- 반복 : 주어진 조건이 참인 동안에 계속 실행 하는 것
- 조건문 사용 예시

```kotlin
package org.example

import kotlin.text.toDouble

fun main() {
    print("Enter the score")
    var score = readLine()?.toDoubleOrNull()
    var grade: String

    if (score == null){
        grade = "invalid"
    } else if (score > 90.0){
        grade = "A"
    // } else if (score >= 80.0 && score < 90.0){
    } else if (score in 80.0..90.0){
        grade = "B"
    } else{
        grade = "F"
    }

    println("score : $score, grade : $grade")
}
```

## when

> when 조건문(`when (condition)`), 
처리 block(`{}`), 
case -> expression(`case -> {value}`)
> 

```kotlin
when (condition){
	case -> {expression}
	...
	else -> {expression}
}
```

- 모든 조건문과 결과(`condition`, `case`, `value`)는 expression으로 사용 가능
- `when (condition)` : 비교 대상, `condition` 생략 가능
- `{}` : 조건문 scope
- `case`
    - 기본적으로는 단일 조건, 복수 조건도 가능(`,` 로 구분)
    - `condition` 생략 시 조건문으로 대체(ex `variable > value`)
    - 혹은 함수의 return값을 조건문으로 사용 가능
- `expression` : block을 형성하여 로직 형성 가능, **마지막 변수** → return

```kotlin
package org.example

import kotlin.text.toDouble

fun main() {
    val x = 1.1
    val a = when {
        x == 1.0 || x == 2.0 || x == 3.0 -> {
            "gadsfasd"
            3
        }
        x in 1.0..3.0 -> 2.99999
        (x !in 1.0..3.0 && x in 3.0..10.0) -> 9.9999
        else -> {
            "adfasdfsdaf"
            "big"
        }
    }

    println(a)   // 2.99999
}
```

---

```kotlin
fun getUserType(): String = "admin"
fun isLoggedIn(): Boolean = true

val accessLevel = when {
    getUserType() == "admin" && isLoggedIn() -> "전체 접근 가능"
    getUserType() == "user" && isLoggedIn() -> "제한된 접근"
    !isLoggedIn() -> "로그인 필요"
    else -> "접근 불가"
}
println("접근 권한: $accessLevel")

```

# for

> 요소 변수, 컬렉션 혹은 범위, 처리 블록
> 

```kotlin
for (variable in collectionOrRange){
	iteration
}
```

- `i in upper downTo lower` : upper → lower
- `i in start..end step step_range` : start → end 까지 step만큼 증가

```kotlin
package org.example

import kotlin.text.toDouble
// import java.util.Random
import kotlin.random.Random

fun main() {
    // val upper = Random().nextInt(10)  // java
    val upper = Random.nextInt(10)  // kotlin
    
    for (i in upper downTo 1) print(i)  // 54321
    for (i in upper downTo 1 step 2) print(i)  // 531
    for (i in 1..upper step 2) print(i)  // 135
}
```

## while

```kotlin
while (condition){
	iteration
}

do {
	iteration
} while(condition)
```

## goto 기반

- `break`, `continue`

## 예제

```kotlin
package org.example

fun main() {
    var odds = 0
    var evens = 0

    for (i in 1..100){
        odds = if (i%2 != 0) odds+i else odds
        evens = if (i%2 == 0) evens+i else evens
    }
    println(odds)   // 2500
    println(evens)  // 2550
}
```

---

```kotlin
package org.example

fun main() {
    for(i in 1..9){
        for(j in 1..9){
            print("${j}x${i} = ${i*j}\t\t")
        }
        println()
    }
}
```

---

```kotlin
// 4x + 5y = 60 의 해(10이하 자연수)
package org.example

fun main() {
    var y: Any

    for(i in 1..10){
        y = (60-4*i)/5
        if ((60-4*i)%5 == 0) println("$i, $y")
    }
}
```

---

```kotlin
package org.example

import org.example.factorial

fun main() {
    println(factorial(5))
}

fun factorial(num: Int): Int{
    if (num==1) {
        return 1
    }
    
    return num*factorial(num-1)
}
```

---

```kotlin
package org.example

import kotlin.random.Random

fun main() {
    var num1: Int
    var num2: Int
    do{
        num1 = Random.nextInt(1,6)
        num2 = Random.nextInt(1,6)
        println("${num1}, ${num2}")
    }while(num1+num2!=5)
}
```