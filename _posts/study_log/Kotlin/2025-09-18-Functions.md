---
title: (Kotlin) 4. 함수
post_order: 4
thumbnail: https://miro.medium.com/v2/resize:fit:1392/1*gRJvfALNZLSVE-2P6Fu_pQ.png
layout: post
author: jhj
categories:
  - StudyLog
  - Kotlin
tags:
  - Kotlin
  - function
excerpt: 함수의 선언 규칙 및 특징
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# style guide

- [안드로이드 코틀린 스타일 가이드](https://developer.android.com/kotlin/style-guide?hl=ko)
- **들여쓰기** : “ “ x 4
- **변수명**(camelCase), **class/file**(UpperCamel)
- **상수 :** UPPER_SNAKE_CASE
    - 대문자, `_`로 단어 구분

```kotlin
// const
const val NUMBER = 5
val NAMES = listOf("Alice", "Bob")
val AGES = mapOf("Alice" to 35, "Bob" to 32)
val COMMA_JOINER = Joiner.on(',') // Joiner is immutable
val EMPTY_ARRAY = arrayOf()

// varable
val variable = "var"
val nonConstScalar = "non-const"
val mutableCollection: MutableSet = HashSet()
val mutableElements = listOf(mutableInstance)
val mutableValues = mapOf("Alice" to mutableInstance, "Bob" to mutableInstance2)
val logger = Logger.getLogger(MyClass::class.java.name)
val nonEmptyArray = arrayOf("these", "can", "change")
```

## 공백

- 여는 중괄호(**`{`**) 앞
- 예약어(예: **`if`**, **`for`** 또는 **`catch`**)는 같은 줄에서 뒤에 오는 여는 괄호(**`(`**)와 구분
- 2진 연산자의 양쪽
- `.`, `::`, `..` : 붙여쓰기

```kotlin
// keyword
for (i in 0..1) {
}

} else {
}

// operand
val two = 1 + 1

// {}
if (list.isEmpty()) {
}

// , :
val oneAndTwo = listOf(1, 2)

class Foo : Runnable
```

---

```kotlin
// member
val toString = Any::toString

// method
it.toString()

// 범위 연산자
for (i in 1..4) {
  print(i)
}
```

# 절차지향 및 함수형 언어

> java의 객체지향 + 절차지향 + 함수형 추가
객체가 필수가 아님
> 
- parameter, return값의 type 지정 필요
- `unit` : `void`, 생략 가능
    - 즉 return 값이 없다면 `returnType` 생략 가능(혹은 `unit` 명시)

```kotlin
fun funName([variable: type, ..]): [returnType] {
	expression
	[return returnValue]
}

fun funName([variable: type, ..]): [returnType] = returnExpressionResult
```

---

```kotlin
fun square(x: Int): Int = x*x

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

---

```kotlin
package org.example

fun main() {    
    returnVoid()
}

fun returnVoid(): Unit = println("Unit == void")
// fun returnVoid() = println("Unit == void")
```

- 함수의 선언 위치 상관 없음
- 중복 함수 선언 가능

```kotlin
package org.example

// fun sum(a: Int, b: Int): Int = a + b

fun main() {
    fun sum(a: Int, b: Int): Int = a + b
    
    val result = sum(1, 2)
    println(result)
}

// fun sum(a: Int, b: Int): Int = a + b
```

## parmeter/argument

- call-by-value
- parameter immutable(**val**)
- **Position(Keyword) → Default → Vararg → (Default|Keyword) → Collection(Container) parameter** 순서
- `paramVal: type = default`
    - parameter initialize 가능
    - call-by-position → initialize(python과 유사)

```kotlin
fun demo(
    x: Int, 
    y: Int = 10, 
    vararg nums: Int, 
    flag: Boolean = false, 
    items: List<String> = listOf("Z")
) {
    println("x=$x, y=$y, nums=${nums.toList()}, flag=$flag, items=$items")
}

fun main() {
    demo(x = 1, 20, 30, 40, flag = true, items = listOf("A", "B"))
}

>>>

x=1, y=20, nums=[30, 40], flag=true, items=[A, B]
```

## vararg

- 가변 인자(variable number of arguments)
    - 다수의 동일한 데이터 타입(자료형)의 매개 변수를 처리
- `vararg varable: type`
    - `vararg` : 가변 인자를 받을 수 있는 키워드
    - container를 **unpack하는 것이 아닌** **복수개의 인자**를 받음
    - container도 하나의 type으로 지정
- `*` : spread operation
    - unpack array
    - `vararg`의 **argument**

```kotlin
package org.example

fun varargParams(vararg vars: Char) = println(vars)

fun main() {
    varargParams('a', 'b', 'c') // abc

    val charArray = charArrayOf('a', 'b', 'c')
    varargParams(*charArray) // abc
}
```

## lambda

- `{ (parameter) -> expression }`
- `run lambdaFun`
    - `lambdaFun`(scope 함수) 실행
    - **Unit** fun 실행

```kotlin
fun main() {
    val isSumEven = { x: Int, y: Int -> if ((x+y)%2==0) "true, " + (x + y).toString() else "false" }
    val printsum = { println(isSumEven(1,1)) }

    printsum()
    run { println("run lambda fun") }
    // run { str: String -> println(str) }("run") // error
}
```

- 일급 객체(first class)
    - 기본 변수 타입처럼 행동하는 객체
    - 함수의 **인자**, **반환값**으로 사용 가능
    - **변수**에 담을 수 있음
    - lambda도 일급 객체
    - lambda를 파라미터로 받는 함수를 고차 함수 라고 함(이게 뭐라고 용어까지 있냐)
- 2중 함수 생성
- lambda가 마지막에 올 경우 lambda를 인자 외부에 선언 가능
- `fun funName(..., lambdaName: (paramsType) -> returnType, ...)`

```kotlin
fun highFunc(sum: (Int, Int) -> Int, a: Int, b: Int): Int = sum(a, b)	
fun nestedFunc(a: Int, b: Int): Int {
    val sum = { x: Int, y: Int -> x + y}
    return sum(a, b)
}

fun main(){
	// highFunc({ x, y -> x + y }, a, b)) == nestedFunc(a, b)
	println(highFunc({ x, y -> x + y }, 10, 20))
	println(nestedFunc(10, 20))
}
```

---

```kotlin
fun highFunc(a: Int, b: Int, sum: (Int, Int) -> Int) = println(sum(a, b))

fun main(){
	highFunc(10, 20, { x, y -> x + y })
	highFunc(10, 20) { x, y -> x + y }
}
```

- `fun funName(lambdaName: () -> Unit){ lambdaName(); ... }`
    - parameter, return 값이 없는 경우 바로 실행 가능한 lambda 생성 가능
    - `Unit` 명시적 선언 필요

```kotlin
fun runLambda(a: Int, action: () -> Unit) {
    println(a)
    action()
    action()
    action()
    action()
}

fun main(){
	runLambda(1) { println("abc") }
}
```

# 예제

```kotlin
fun floatAvg(first: Float = 0f, vararg nums: Float): Double {
    var length = nums.size
    if (length == 0) return first.toDouble()
    
    return (first.toDouble() + nums.sum()) / (length + 1)
}

fun main(){
    val floatArray = floatArrayOf(1.0f, .5f, .5f)

	println(floatAvg())                     // 0.0
	println(floatAvg(1.0f))                 // 1.0
	println(floatAvg(10.0f, *floatArray))   // 3.0
}
```

---

```kotlin
fun main(){
    val isEven = { x: Int -> x%2==0 }
    
    println(isEven(2))
    isEvneFun(2) { x: Int -> x%2==0 }
}

fun isEvneFun(x: Int, result: (Int) -> Boolean) = println(result(x))
```