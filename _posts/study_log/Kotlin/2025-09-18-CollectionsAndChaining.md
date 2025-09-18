---
title: (Kotlin) 11. 컬렉션 및 체이닝
post_order: 11
thumbnail: https://blog.kakaocdn.net/dna/4QZI7/btsLjoHS3VD/AAAAAAAAAAAAAAAAAAAAAKJbshSZMzSOPUA8s0raa5-DoJRcNCKdKP07mSJwjLzm/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1759244399&allow_ip=&allow_referer=&signature=I3gCpEhAdPmhbJM8KvCQrU87pmo%3D
layout: post
author: jhj
categories:
  - StudyLog
  - Kotlin
tags:
  - Kotlin
  - Collections
  - Chaning
excerpt: 컬렉션(복수 데이터 표현) 및 함수형 언어 특징인 체이닝 사용방법
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# 배열(Array)

- 같은 type, 고정 길이
    - 값 변경 가능, 크기 변경 불가
- 참조 타입(primitive type도 박싱 됨)
- `val array = Array(size, [default])`
- `val array = Array(size) {default)`
    - 선언
    - **lambda 함수**로 **default** 지정 가능
    - `Array` : default 값 필수
    - `TypeArray` : default 생략 가능

```kotlin
val intArray = IntArray(10)
val charArray = CharArray(10)
val longArray = LongArray(10)
val doubleArray = DoubleArray(10)

val stringArr = Array(10, { item -> "" })
val stringArr = Array(10) { "" }
```

- `val arrayOf(...)` : initialize
    - `Array<type>` : array type
    - type, size compiler가 추론(primitive type), type 지정 시 성능 향상
    - value 할당

```kotlin
val dayArray = arrayOf("M", "T", ...)
val strArr: Array<String> = arrayOf("a", ...)
val intArr = arrayOf(1,2,3)
val intArr = intArrayOf(1,2,3)  // type 지정, 성능 향상
```

## index

- `arrayName[index] =value`
- `arrayName.set(index, value)`
- `arrayName.get(index, value)`

```kotlin
val someArray = Array(10)
someArray[1] = 1
someArray.set(2, 2)
```

# List

- `listOf<type>()`
- `listOf(value, ...)`
- mutable 접두어 : 가변 list
- `mutableLstOf<type>()`
- `mutableListOf(value, ...)`
- index : array 동일

```kotlin
val list = listOf<String>()
val mutableList = mutableListOf<String>()
```

## 생성/삭제

- `list.add(value)`
- `list.removeAt(index)`
- `list.remove(value)` : 앞에서 부터 단일 삭제

```kotlin
fun main() { 
    val list = listOf<String>()
    val mutableList = mutableListOf<String>()
    mutableList.add("a")
    mutableList.add("b")
    mutableList.add("c")
    mutableList.add("b")

    mutableList.removeAt(0)
    mutableList.remove("b")
    
    println(mutableList)    // [c, b]
}
```

# Set

- 중복 허용 X
- 순서 X
- index, get 함수 조회 X
- `setOf<type>()`
- `setOf(value, ...)`
- `mutableSetOf<type>()`
- `mutableSetOf(value, ...)`
- `add`, `remove` 동일

# Map

- dictionary
- `mapOf<keyType, valueType>()`
- `mutableMapOf<keyType, valueType>()`

## 삽입/삭제

- `mapOf(key to value, ...)` : initialize
    - `to`를 사용하여 key와 value 구분
- `map[key]` or `map.get(key)`
- `map[key] = value` : 주로 사용
- `map.put(key, value)`
    - `value` 수정도 가능

# 컬랙션 함수

> parmeter를 **함수형 언어 형식**으로 사용
it, this 등 **매개변수** 사용
> 

## filter

- 조건에 맞는 요소 filtering
- return type : **List** / **Set**

```kotlin
fun main() { 
	val list = listOf(1,2,3)
	println(list.filter { it%2 == 0 })  // [2]
}
```

## forEach

- 컨테이너를 순서대로 가져옴

```kotlin
fun main() { 
    val list = listOf(1,2,3)
    list.forEach { print("$it ") }  // 1 2 3
}
```

## map

- 새로운 조함의 컬랙션 함수

```kotlin
fun main() { 
    val names = listOf("Sam", "Peter")
    val lengths = names.map { it.length }

    println(lengths)    // [3, 5]
}
```

## reduce

- 누적 계산
- return : 단일 값

```kotlin
fun main() { 
    val prices = listOf(10, 100, 1000)
    val total = prices.reduce { acc, price -> acc + price }

    println("총합 : $total")    // 총합 : 1110
}
```

## count

- 조건에 맞는 개수 계산
- return : Int

```kotlin
fun main() { 
    val prices = listOf(10, 100, 1000)
    val expensive = prices.count { it > 50 }

    println("$expensive")    // 2
}
```

# 체이닝

> 고차 함수를 조합하여 하나의 코드 작성.
간?결하고 가독성이 좋다.
반복 + 조건 + 변환 작업에 매우 유용
> 

```kotlin
fun main() { 
    val numbers = listOf(1, 2, 3, 4, 5, 6)
    val result = numbers
        .filter { it%2 == 0 }
        .map { it*it }

    println(result)     // [4, 16, 36]
}
```

# 레제

```kotlin
fun main() { 
    val names = listOf("홍길동", "김철수", "Elizabeth", "John", "Alexander")
    
    names
        .filter { it.length > 5 }
        .forEach { print("${it.uppercase()} ") }    // ELIZABETH ALEXANDER
}
```

---

```kotlin
fun main() { 
    val products = mapOf(
        "apple" to 3000,
        "banana" to 1500,
        "graph" to 4000,
        "peach" to 2800,
    )

    products
        .filter { it.value >= 3000 }
        .forEach { print("${it.key} ") }    // apple graph 
}
```

---

```kotlin
fun main() { 
    val data = listOf(
        listOf(1, 2, 3),
        listOf(4, 5, 6),
        listOf(7, 8, 9),
    )

    println(data
        .reduce { a, b -> a + b }
        .filter { it%2 == 0 }
        .reduce { a, b -> a + b }
    )   // 20
}

---

    println(data
        .flatten()
        .filter { it%2 == 0 }
        .sum()
    )   // 20
}
```

---

```kotlin
fun main() { 
    val numbers = arrayOf(1, 3, 10, 5, 7, 9)

    println(numbers.reduce { a, b -> if(b>a) b else a })    // 10
    println(numbers.max())    // 10
}
```

---

```kotlin
fun main() { 
    val words = arrayOf("Java", "Kotlin", "Swift", "KotlinConf", "Python")

    words.filter { it.contains("Kotlin") }.forEach { print("$it ") }    
    // Kotlin KotlinConf
}
```